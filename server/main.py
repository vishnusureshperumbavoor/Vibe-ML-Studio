from fastapi import FastAPI, HTTPException, Body, Form, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import subprocess
import asyncio
import os
import tempfile
import sys
import re
import time
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from inference import native_manager
from typing import List, Optional
from distillation_service import distiller
from dataset_uploader import upload_dataset_to_hf
from benchmark_runner import runner as bench_runner

# Load HF_TOKEN from server/.env or project root
load_dotenv() # Check server/
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")) # Check project root

# Create the FastAPI App
app = FastAPI(title="Vibe Training Execution Engine")

# Base directory for skills and file access (Project Root)
BASE_DIR = os.path.dirname(os.path.abspath(__file__)) # Directory of main.py (server/)
PROJECT_ROOT = os.path.dirname(BASE_DIR)              # One level up (Vibe-ML-platform/)

# VML-Standard Directory Structure
MODELS_PARENT = os.path.join(BASE_DIR, "models")
MODELS_DIR = os.path.join(MODELS_PARENT, "base_models") # HF Base Models
GGUF_DIR = os.path.join(MODELS_PARENT, "gguf")          # Quantized Models
ADAPTERS_DIR = os.path.join(MODELS_PARENT, "adapters")  # Fine-tuned Adapters
ONNX_DIR = os.path.join(MODELS_PARENT, "onnx_export")    # ONNX Models
DATASETS_DIR = os.path.join(BASE_DIR, "data", "datasets") 
TEXT_SOURCES_DIR = os.path.join(BASE_DIR, "data", "text_sources")
GENERATED_IMAGES_DIR = os.path.join(BASE_DIR, "data", "generated")

# Ensure necessary directories exist
for d in [MODELS_PARENT, MODELS_DIR, GGUF_DIR, ADAPTERS_DIR, ONNX_DIR, DATASETS_DIR, TEXT_SOURCES_DIR, GENERATED_IMAGES_DIR]:
    if not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

# Allow the React frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount ONNX models directory for browser downloads
app.mount("/onnx_models", StaticFiles(directory=ONNX_DIR), name="onnx_models")

class ExecuteRequest(BaseModel):
    code: str

class FileReadRequest(BaseModel):
    path: str

class FileWriteRequest(BaseModel):
    skill_name: str
    filename: str
    content: str



class NativeChatRequest(BaseModel):
    model_filename: str
    messages: List[dict]
    lora_slug: Optional[str] = None

class DeleteModelRequest(BaseModel):
    name: str
    type: str
    lora_slug: Optional[str] = None
    onnx_slug: Optional[str] = None

class ImageGenerateRequest(BaseModel):
    prompt: str
    model_id: Optional[str] = "runwayml/stable-diffusion-v1-5"
    steps: Optional[int] = 20
    guidance: Optional[float] = 7.5

class ImageImg2ImgRequest(BaseModel):
    prompt: str
    base64_image: str
    strength: Optional[float] = 0.6
    model_id: Optional[str] = "runwayml/stable-diffusion-v1-5"
    steps: Optional[int] = 20

from fastapi.responses import StreamingResponse
import json

def get_skill_paths():
    """Scans the skills directory and returns all 'references' subfolders."""
    paths = []
    skills_root = os.path.join(PROJECT_ROOT, "skills")
    if not os.path.exists(skills_root):
        return paths
        
    for skill in os.listdir(skills_root):
        ref_path = os.path.join(skills_root, skill, "references")
        if os.path.exists(ref_path):
            paths.append(os.path.abspath(ref_path).replace("\\", "/"))
    return paths

from kernel import kernel_manager

def open_file_dialog():
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    file_path = filedialog.askopenfilename(
        title="Select PDF for VML Ingestion",
        filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")]
    )
    root.destroy()
    return file_path

@app.get("/browse_pdf")
async def browse_pdf():
    print("🔔 [VML] Received request for /browse_pdf")
    """Opens a native Windows file dialog to select a PDF in a non-blocking way."""
    try:
        loop = asyncio.get_event_loop()
        file_path = await loop.run_in_executor(None, open_file_dialog)
        return {"path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/execute")
async def execute_code(req: ExecuteRequest):
    code_lines = req.code.splitlines()
    skill_paths = get_skill_paths()
    python_code_lines = [
        "import os, sys",
        f"sys.path.extend({json.dumps(skill_paths)})"
    ]
    
    # 1. Intercept "Magic Pip" Commands and convert to os.system for the kernel
    BUILT_INS = {"os", "sys", "urllib", "zipfile", "zipfile36", "tarfile", "time", "json", "math", "re", "shutil", "tempfile", "requests"}
    
    for line in code_lines:
        stripped = line.strip().lstrip('\ufeff')
        if stripped.startswith("!") or stripped.startswith("%"):
            if "pip install" in stripped:
                packages = stripped.replace("!pip install", "").replace("%pip install", "").strip().split()
                packages = [p for p in packages if p.lower() not in BUILT_INS]
                if packages:
                    pkg_str = " ".join(packages)
                    python_code_lines.append(f'import os; os.system(\'"{sys.executable}" -m pip install {pkg_str}\')')
                continue 
            
            command = stripped.lstrip("!%")
            python_code_lines.append(f'import os; os.system("{command}")')
            continue 
            
        python_code_lines.append(line)
            
    clean_code = '\n'.join(python_code_lines)

    async def stream_output():
        try:
            is_gradio = False
            has_error = False
            async for line in kernel_manager.execute(clean_code):
                # Clean prompt noise
                clean_line = line.lstrip('> ').lstrip('. ').replace('\r', '\n')
                
                # Detect Tracebacks for error reporting (since kernel doesn't exit)
                if "Traceback (most recent call last):" in line or "NameError:" in line or "ValueError:" in line:
                    has_error = True

                # Detect Gradio startup
                if "Running on local URL" in clean_line:
                    is_gradio = True
                    yield f"data: {json.dumps({'output': clean_line, 'is_done': True, 'is_gradio': True})}\n\n"
                
                yield f"data: {json.dumps({'output': clean_line, 'is_done': False})}\n\n"
            
            if not is_gradio:
                yield f"data: {json.dumps({'output': '', 'is_done': True, 'is_error': has_error})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'output': str(e), 'is_done': True, 'is_error': True})}\n\n"

    return StreamingResponse(stream_output(), media_type="text/event-stream")

@app.post("/restart_kernel")
async def restart_kernel():
    await kernel_manager.stop()
    await kernel_manager.start()
    return {"status": "Kernel restarted"}

@app.get("/list_skills")
async def list_skills():
    try:
        skills_path = os.path.join(PROJECT_ROOT, "skills")
        if not os.path.exists(skills_path):
            return {"skills": []}
            
        skills = []
        for d in os.listdir(skills_path):
            if os.path.isdir(os.path.join(skills_path, d)):
                skills.append(d)
        return {"skills": skills}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/interrupt")
async def interrupt_execution():
    """
    Interrupts and halts any active running code block in the interactive Python kernel.
    """
    try:
        await kernel_manager.interrupt()
        try:
            from telegram_notifier import telegram_notifier
            telegram_notifier.send_interrupted(0, 0)
        except Exception:
            pass
        return {"status": "success", "message": "Kernel process interrupted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/telegram/status")
async def get_telegram_status():
    """
    Returns Telegram Bot connection status and detected chat ID.
    """
    try:
        from telegram_notifier import telegram_notifier
        chat_id = telegram_notifier._resolve_chat_id()
        return {
            "configured": telegram_notifier.enabled,
            "has_token": bool(telegram_notifier.bot_token and telegram_notifier.bot_token != "your_telegram_token_here"),
            "chat_id": chat_id or "Not detected yet (send /start to your bot in Telegram)"
        }
    except Exception as e:
        return {"configured": False, "error": str(e)}

@app.post("/read_file")
async def read_file(req: FileReadRequest):
    try:
        # Security: Normalize path and prevent directory traversal
        abs_path = os.path.abspath(os.path.join(PROJECT_ROOT, req.path))
        if not abs_path.startswith(PROJECT_ROOT):
            raise HTTPException(status_code=403, detail="Access denied: Path outside workspace")
            
        # Allowed extensions
        ext = os.path.splitext(abs_path)[1].lower()
        if ext not in [".md", ".py", ".json", ".txt", ".csv", ".yaml", ".yml"]:
            raise HTTPException(status_code=400, detail=f"File extension {ext} not allowed for reading.")

        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="File not found")

        with open(abs_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save_skill")
async def save_skill(req: FileWriteRequest):
    """
    Skill Factory: Saves a new skill definition (L2) or resource (L3) to the skills/ directory.
    Standard Path: skills/<skill_name>/SKILL.md
    Resource Path: skills/<skill_name>/references/<filename>
    """
    try:
        # Security: kebab-case names only
        import re
        if not re.match(r'^[a-z0-9\-]+$', req.skill_name):
            raise HTTPException(status_code=400, detail="Invalid skill name. Use kebab-case.")
            
        skill_dir = os.path.join(PROJECT_ROOT, "skills", req.skill_name)
        
        # Handle reference files vs main skill docs
        if req.filename.startswith("references/"):
            target_dir = os.path.join(skill_dir, "references")
            target_filename = req.filename.replace("references/", "")
        else:
            target_dir = skill_dir
            target_filename = req.filename

        if not os.path.exists(target_dir):
            os.makedirs(target_dir)

        abs_path = os.path.join(target_dir, target_filename)
        
        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write(req.content)
            
        return {"success": True, "path": abs_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/images/{filename}")
async def get_image(filename: str):
    """
    Serves a generated image file from the server/data/generated directory.
    Usage: [IMAGE: slice.png] in stdout will be picked up by React.
    """
    # Check both generated and base_models for compatibility
    gen_path = os.path.join(GENERATED_IMAGES_DIR, filename)
    base_path = os.path.join(MODELS_DIR, filename)
    
    file_path = gen_path if os.path.exists(gen_path) else base_path
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(file_path)

# --- Image Generation Endpoints ---
# --- Image Status & Download Endpoints ---
@app.get("/image/status")
async def get_image_model_status(model_id: Optional[str] = "stable-diffusion-v1-5/stable-diffusion-v1-5"):
    try:
        return image_service.get_status(model_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/image/download")
async def download_image_model(model_id: Optional[str] = Form("stable-diffusion-v1-5/stable-diffusion-v1-5")):
    try:
        res = image_service.start_background_download(model_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from image_service import image_service
import base64
from io import BytesIO
from PIL import Image
import uuid
from fastapi import Form, UploadFile, File
import tempfile

@app.post("/image/generate")
async def generate_image(
    prompt: str = Form(...),
    model_id: Optional[str] = Form("runwayml/stable-diffusion-v1-5"),
    steps: Optional[int] = Form(20),
    guidance_scale: Optional[float] = Form(7.5)
):
    try:
        # Run in executor to avoid blocking FastAPI
        loop = asyncio.get_event_loop()
        img = await loop.run_in_executor(None, image_service.generate, prompt, model_id, int(steps), float(guidance_scale))
        
        filename = f"gen_{uuid.uuid4().hex[:8]}.png"
        save_path = os.path.join(GENERATED_IMAGES_DIR, filename)
        img.save(save_path)
        
        return {"filename": filename, "url": f"/images/{filename}"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/image/img2img")
async def img2img(
    prompt: str = Form(...),
    image: UploadFile = File(...),
    strength: Optional[float] = Form(0.6),
    model_id: Optional[str] = Form("runwayml/stable-diffusion-v1-5"),
    steps: Optional[int] = Form(20)
):
    try:
        # Read the uploaded file
        contents = await image.read()
        pil_image = Image.open(BytesIO(contents)).convert("RGB")
        
        # Save temp file for the service
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            pil_image.save(tmp.name)
            tmp_path = tmp.name

        loop = asyncio.get_event_loop()
        img = await loop.run_in_executor(None, image_service.img2img, prompt, tmp_path, model_id, int(steps), float(strength))
        
        # Cleanup
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

        filename = f"refine_{uuid.uuid4().hex[:8]}.png"
        save_path = os.path.join(GENERATED_IMAGES_DIR, filename)
        img.save(save_path)
        
        return {"filename": filename, "url": f"/images/{filename}"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/native/chat")
async def native_chat(req: NativeChatRequest):
    """
    Streaming endpoint for native llama.cpp inference.
    Supports base GGUF + optional LoRA adapters.
    """
    def chat_generator():
        try:
            # 1. Resolve LoRA path if provided
            lora_path = None
            if req.lora_slug:
                # Adapters are stored in server/models/adapters/<slug>
                abs_lora_dir = os.path.join(ADAPTERS_DIR, req.lora_slug)
                if os.path.exists(abs_lora_dir):
                    lora_path = abs_lora_dir
            
            # 2. Load the model (manager handles swapping/caching)
            native_manager.load_model(req.model_filename, lora_path)
            
            # 3. Stream tokens (Thread-safe)
            for chunk in native_manager.chat_stream(req.model_filename, lora_path, req.messages):
                # chunk is now {"content": "...", "ttft": ..., "tps": ...}
                payload = {
                    "content": chunk["content"],
                    "ttft": chunk["ttft"],
                    "tps": chunk["tps"]
                }
                yield f"data: {json.dumps(payload)}\n\n"
            
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
    return StreamingResponse(chat_generator(), media_type="text/event-stream")



# --- GGUF Model Downloader Endpoints ---
import requests
import threading

gguf_download_state = {
    "status": "idle",
    "filename": "qwen2-0_5b-instruct-q4_k_m.gguf",
    "repo_id": "Qwen/Qwen2-0.5B-Instruct-GGUF",
    "progress": 0,
    "downloaded_mb": 0,
    "total_mb": 0,
    "message": ""
}
_gguf_download_lock = threading.Lock()

def _gguf_download_worker(repo_id: str, filename: str):
    global gguf_download_state
    temp_path = os.path.join(GGUF_DIR, f"{filename}.downloading")
    target_path = os.path.join(GGUF_DIR, filename)
    try:
        if not os.path.exists(GGUF_DIR):
            os.makedirs(GGUF_DIR, exist_ok=True)
            
        url = f"https://huggingface.co/{repo_id}/resolve/main/{filename}"
        headers = {}
        hf_token = os.getenv("HF_TOKEN")
        if hf_token:
            headers["Authorization"] = f"Bearer {hf_token}"
            
        print(f"📥 Starting streaming download: {url} -> {target_path}")
        response = requests.get(url, headers=headers, stream=True, timeout=60, allow_redirects=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get("content-length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024  # 1MB chunk
        
        with open(temp_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    percent = round((downloaded / total_size) * 100, 1) if total_size > 0 else 0
                    downloaded_mb = round(downloaded / (1024 * 1024), 1)
                    total_mb = round(total_size / (1024 * 1024), 1)
                    
                    with _gguf_download_lock:
                        gguf_download_state["status"] = "downloading"
                        gguf_download_state["progress"] = percent
                        gguf_download_state["downloaded_mb"] = downloaded_mb
                        gguf_download_state["total_mb"] = total_mb
                        gguf_download_state["message"] = f"{downloaded_mb} MB / {total_mb} MB ({percent}%)"
                        
        if os.path.exists(temp_path):
            os.replace(temp_path, target_path)
            
        with _gguf_download_lock:
            gguf_download_state["status"] = "ready"
            gguf_download_state["progress"] = 100
            gguf_download_state["message"] = f"{filename} downloaded successfully!"
        print(f"✅ Download complete: {target_path}")
    except Exception as e:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        with _gguf_download_lock:
            gguf_download_state["status"] = "error"
            gguf_download_state["message"] = f"Download failed: {str(e)}"
        print(f"❌ Download error for {filename}: {e}")

@app.get("/models/gguf_status")
async def get_gguf_status(filename: Optional[str] = "qwen2-0_5b-instruct-q4_k_m.gguf"):
    target_path = os.path.join(GGUF_DIR, filename)
    is_present = os.path.exists(target_path)
    with _gguf_download_lock:
        status = "ready" if is_present else gguf_download_state.get("status", "idle")
        if gguf_download_state.get("status") == "downloading" and not is_present:
            status = "downloading"
        return {
            "filename": filename,
            "is_present": is_present,
            "status": status,
            "progress": gguf_download_state.get("progress", 0),
            "downloaded_mb": gguf_download_state.get("downloaded_mb", 0),
            "total_mb": gguf_download_state.get("total_mb", 0),
            "message": gguf_download_state.get("message", "")
        }

@app.post("/models/download_gguf")
async def download_gguf_model(
    repo_id: Optional[str] = Form("Qwen/Qwen2-0.5B-Instruct-GGUF"),
    filename: Optional[str] = Form("qwen2-0_5b-instruct-q4_k_m.gguf")
):
    global gguf_download_state
    target_path = os.path.join(GGUF_DIR, filename)
    if os.path.exists(target_path):
        return {"status": "ready", "message": f"{filename} already exists locally."}

    with _gguf_download_lock:
        if gguf_download_state["status"] == "downloading":
            return {"status": "already_downloading", "message": "Download is already in progress."}
        gguf_download_state["status"] = "downloading"
        gguf_download_state["repo_id"] = repo_id
        gguf_download_state["filename"] = filename
        gguf_download_state["progress"] = 0
        gguf_download_state["downloaded_mb"] = 0
        gguf_download_state["total_mb"] = 0
        gguf_download_state["message"] = f"Starting download of {filename}..."

    thread = threading.Thread(target=_gguf_download_worker, args=(repo_id, filename), daemon=True)
    thread.start()
    return {"status": "started", "message": f"Download of {filename} started in background."}

@app.get("/list_native_models")
async def list_native_models():
    """
    Returns a unified list of available native models.
    Includes base GGUFs, fine-tuned adapters, and ONNX models with rich metadata.
    """
    results = []
    
    # 1. Base Models (.gguf) in server/models/gguf
    if os.path.exists(GGUF_DIR):
        for f in os.listdir(GGUF_DIR):
            if f.lower().endswith(".gguf"):
                file_path = os.path.join(GGUF_DIR, f)
                size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 1) if os.path.isfile(file_path) else 0
                mtime = os.path.getmtime(file_path)
                
                # Extract quantization and size tags
                quant = "Q4_K_M"
                if "q8_0" in f.lower(): quant = "Q8_0"
                elif "q4_k" in f.lower(): quant = "Q4_K_M"
                elif "q5" in f.lower(): quant = "Q5_K_M"
                
                params = "0.5B"
                if "0.5b" in f.lower() or "0_5b" in f.lower(): params = "0.5B"
                elif "1.5b" in f.lower() or "1_5b" in f.lower(): params = "1.5B"
                elif "7b" in f.lower(): params = "7B"
                
                results.append({
                    "name": f,
                    "display_name": f.replace('.gguf', '').replace('-', ' ').title(),
                    "source": "native",
                    "type": "base",
                    "size_mb": size_mb,
                    "created_at": mtime,
                    "quantization": quant,
                    "parameters": params,
                    "architecture": "Qwen2" if "qwen" in f.lower() else "Llama",
                    "description": "Base quantized instruction-tuned model for local inference."
                })
    
    # 2. Fine-tuned Adapters in server/models/adapters
    if os.path.exists(ADAPTERS_DIR):
        for slug in os.listdir(ADAPTERS_DIR):
            lora_dir = os.path.join(ADAPTERS_DIR, slug)
            if os.path.isdir(lora_dir):
                # Check for adapter weights
                has_weights = (
                    os.path.exists(os.path.join(lora_dir, "adapter_model.safetensors")) or
                    os.path.exists(os.path.join(lora_dir, "adapter_model.bin")) or
                    os.path.exists(os.path.join(lora_dir, "adapter.gguf"))
                )
                if has_weights:
                    # Calculate directory size
                    total_bytes = sum(
                        os.path.getsize(os.path.join(lora_dir, f))
                        for f in os.listdir(lora_dir)
                        if os.path.isfile(os.path.join(lora_dir, f))
                    )
                    size_mb = round(total_bytes / (1024 * 1024), 1)
                    mtime = os.path.getmtime(lora_dir)
                    
                    # Read adapter_config.json if available
                    cfg_path = os.path.join(lora_dir, "adapter_config.json")
                    base_model = "Qwen/Qwen2-0.5B"
                    rank = 16
                    if os.path.exists(cfg_path):
                        try:
                            with open(cfg_path, 'r', encoding='utf-8') as cf:
                                cfg = json.load(cf)
                                base_model = cfg.get("base_model_name_or_path", base_model)
                                rank = cfg.get("r", rank)
                        except Exception:
                            pass
                    
                    # Infer dataset from slug (e.g. qwen2-0-5b-medquad-instruct-vml1 -> MedQuAD)
                    dataset_name = "Custom Domain"
                    if "medquad" in slug.lower(): dataset_name = "lavita/MedQuAD"
                    elif "alpaca" in slug.lower(): dataset_name = "Alpaca Cleaned"
                    
                    results.append({
                        "name": f"Fine-tuned: {slug}",
                        "display_name": slug.replace('-', ' ').title(),
                        "source": "native",
                        "type": "adapter",
                        "lora_slug": slug,
                        "base_model": base_model,
                        "lora_rank": rank,
                        "dataset_id": dataset_name,
                        "size_mb": size_mb,
                        "created_at": mtime,
                        "architecture": "LoRA Adapter",
                        "description": f"Domain-adapted LoRA model trained on {dataset_name}."
                    })

    # 3. ONNX Models in server/models/onnx_export
    if os.path.exists(ONNX_DIR):
        for slug in os.listdir(ONNX_DIR):
            onnx_path = os.path.join(ONNX_DIR, slug)
            if os.path.isdir(onnx_path):
                # Check for onnx files
                onnx_files = [f for f in os.listdir(onnx_path) if f.endswith(".onnx")]
                if onnx_files:
                    total_bytes = sum(
                        os.path.getsize(os.path.join(onnx_path, f))
                        for f in os.listdir(onnx_path)
                        if os.path.isfile(os.path.join(onnx_path, f))
                    )
                    size_mb = round(total_bytes / (1024 * 1024), 1)
                    mtime = os.path.getmtime(onnx_path)
                    
                    results.append({
                        "name": f"ONNX: {slug}",
                        "display_name": slug.replace('-', ' ').title(),
                        "source": "onnx",
                        "type": "onnx",
                        "onnx_slug": slug,
                        "size_mb": size_mb,
                        "created_at": mtime,
                        "architecture": "ONNX Runtime",
                        "description": "In-browser WebAssembly & WebGPU runtime export."
                    })
                    
    return {"models": results}
 
 
@app.post("/delete_model")
async def delete_model(req: DeleteModelRequest):
    """
    Deletes a local model from disk.
    """
    try:
        import shutil
        if req.type == "adapter" and req.lora_slug:
            target_dir = os.path.join(ADAPTERS_DIR, req.lora_slug)
            if os.path.exists(target_dir):
                shutil.rmtree(target_dir)
                return {"status": "success", "message": f"Adapter {req.lora_slug} deleted successfully."}
            else:
                raise HTTPException(status_code=404, detail="Adapter directory not found.")
                
        elif req.type == "base":
            target_file = os.path.join(GGUF_DIR, req.name)
            if os.path.exists(target_file):
                os.remove(target_file)
                return {"status": "success", "message": f"Base model {req.name} deleted successfully."}
            else:
                raise HTTPException(status_code=404, detail="Base model file not found.")
                
        elif req.type == "onnx" and req.onnx_slug:
            target_dir = os.path.join(ONNX_DIR, req.onnx_slug)
            if os.path.exists(target_dir):
                shutil.rmtree(target_dir)
                return {"status": "success", "message": f"ONNX model {req.onnx_slug} deleted successfully."}
            else:
                raise HTTPException(status_code=404, detail="ONNX model directory not found.")
                
        else:
            raise HTTPException(status_code=400, detail="Invalid model deletion request.")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/save_token")
async def save_token(payload: dict = Body(...)):
    """
    Persists a token (e.g., HF_TOKEN) to the .env file in the server directory.
    """
    try:
        token_key = payload.get("key")
        token_val = payload.get("value")
        if not token_key or not token_val:
            raise HTTPException(status_code=400, detail="Key and Value required")

        env_path = os.path.join(BASE_DIR, ".env")
        
        # Read existing lines
        lines = []
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        
        # Update or add the key
        found = False
        new_line = f"{token_key}={token_val}\n"
        for i, line in enumerate(lines):
            if line.startswith(f"{token_key}="):
                lines[i] = new_line
                found = True
                break
        
        if not found:
            lines.append(new_line)
            
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
            
        # Also update the current environment so it's active immediately
        os.environ[token_key] = token_val
        
        return {"success": True, "message": f"{token_key} saved and active."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BenchmarkRequest(BaseModel):
    dataset: str
    model_filename: str
    lora_slug: Optional[str] = None
    num_questions: int = 50

@app.post("/benchmark/run")
async def run_benchmark(req: BenchmarkRequest):
    """
    Runs a benchmark (MMLU or GSM8K) against a given model or adapter.
    """
    try:
        # Load the model into the NativeInferenceManager
        lora_path = None
        if req.lora_slug:
            abs_lora_dir = os.path.join(ADAPTERS_DIR, req.lora_slug)
            if os.path.exists(abs_lora_dir):
                lora_path = abs_lora_dir
                
        native_manager.load_model(req.model_filename, lora_path)

        # Run the benchmark asynchronously to prevent blocking the event loop
        loop = asyncio.get_event_loop()
        
        if req.dataset.lower() == "gsm8k":
            result = await loop.run_in_executor(None, bench_runner.run_gsm8k, req.model_filename, lora_path, req.num_questions)
        elif req.dataset.lower() == "mmlu":
            result = await loop.run_in_executor(None, bench_runner.run_mmlu, req.model_filename, lora_path, req.num_questions)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported benchmark dataset: {req.dataset}")
            
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
            
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/benchmark/status")
async def get_benchmark_status():
    """Polls the current status of the benchmark runner."""
    return bench_runner.status

# --- Distillation & HF Deployment Endpoints ---
class DistillRequest(BaseModel):
    collection_name: str
    dataset_name: Optional[str] = None
    auto_deploy: bool = False
    persona: Optional[str] = None

class TextDistillRequest(BaseModel):
    raw_text: str
    dataset_name: Optional[str] = None
    auto_deploy: bool = False
    persona: Optional[str] = None
    target_pairs: int = 100

class TextSourceRequest(BaseModel):
    name: Optional[str] = None
    raw_text: str

def _safe_slug(name: str, fallback: str = "pasted_text") -> str:
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", (name or fallback).strip()).strip("_").lower()
    return slug or fallback

@app.post("/distill/start")
async def start_distillation(req: DistillRequest):
    """Triggers the distillation process in a background task."""
    if distiller.status["step"] != "idle" and distiller.status["step"] != "complete":
        raise HTTPException(status_code=400, detail="A distillation task is already running.")
    
    # We run it in the background with the autonomous flag
    asyncio.create_task(distiller.distill_collection(req.collection_name, auto_deploy=req.auto_deploy, persona=req.persona))
    return {"status": "started", "collection": req.collection_name, "auto_deploy": req.auto_deploy, "persona": req.persona}

@app.post("/distill/text")
async def start_text_distillation(req: TextDistillRequest):
    """Creates an Alpaca JSONL dataset directly from pasted text without RAG/vector indexing."""
    if distiller.status["step"] != "idle" and distiller.status["step"] != "complete" and distiller.status["step"] != "error":
        raise HTTPException(status_code=400, detail="A distillation task is already running.")

    dataset_name = req.dataset_name or "pasted_text"
    asyncio.create_task(
        distiller.distill_text(
            req.raw_text,
            dataset_name=dataset_name,
            auto_deploy=req.auto_deploy,
            persona=req.persona or "Generic",
            target_pairs=req.target_pairs,
        )
    )
    return {"status": "started", "dataset_name": dataset_name, "auto_deploy": req.auto_deploy, "persona": req.persona or "Generic", "target_pairs": req.target_pairs}

@app.post("/text_sources")
async def save_text_source(req: TextSourceRequest):
    """Stores pasted text as a reusable source without vector/RAG indexing."""
    raw_text = (req.raw_text or "").strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="No pasted text provided.")

    slug = _safe_slug(req.name or "pasted_text")
    source_id = f"{slug}_{int(time.time())}"
    text_path = os.path.join(TEXT_SOURCES_DIR, f"{source_id}.txt")
    meta_path = os.path.join(TEXT_SOURCES_DIR, f"{source_id}.json")

    with open(text_path, "w", encoding="utf-8") as f:
        f.write(raw_text)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "id": source_id,
                "display_name": req.name or "Pasted Text",
                "chars": len(raw_text),
                "created_at": time.time(),
            },
            f,
        )

    return {"status": "saved", "source": {"id": source_id, "display_name": req.name or "Pasted Text", "chars": len(raw_text)}}

@app.get("/text_sources")
async def list_text_sources():
    """Lists pasted text sources saved for later Alpaca distillation."""
    sources = []
    if not os.path.exists(TEXT_SOURCES_DIR):
        return {"sources": []}

    for f in os.listdir(TEXT_SOURCES_DIR):
        if not f.endswith(".json"):
            continue
        meta_path = os.path.join(TEXT_SOURCES_DIR, f)
        try:
            with open(meta_path, "r", encoding="utf-8") as mf:
                meta = json.load(mf)
            text_path = os.path.join(TEXT_SOURCES_DIR, f.replace(".json", ".txt"))
            meta["size_kb"] = os.path.getsize(text_path) // 1024 if os.path.exists(text_path) else 0
            sources.append(meta)
        except Exception:
            continue
    return {"sources": sorted(sources, key=lambda item: item.get("created_at", 0), reverse=True)}

@app.get("/text_sources/{source_id}")
async def get_text_source(source_id: str):
    """Fetches a saved pasted text source."""
    safe_id = _safe_slug(source_id)
    text_path = os.path.join(TEXT_SOURCES_DIR, f"{safe_id}.txt")
    meta_path = os.path.join(TEXT_SOURCES_DIR, f"{safe_id}.json")
    if not os.path.exists(text_path):
        raise HTTPException(status_code=404, detail="Text source not found.")

    with open(text_path, "r", encoding="utf-8") as f:
        raw_text = f.read()
    meta = {"id": safe_id, "display_name": safe_id, "chars": len(raw_text)}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as mf:
                meta.update(json.load(mf))
        except Exception:
            pass
    return {"source": meta, "raw_text": raw_text}

@app.get("/distill/status")
async def get_distill_status():
    """Polls the current status of the distillation agent."""
    return distiller.status

@app.post("/distill/deploy")
async def deploy_dataset(req: DistillRequest):
    """Uploads the most recent distilled dataset for a collection to Hugging Face."""
    # Find the latest file for this collection
    dataset_dir = os.path.join(BASE_DIR, "data", "datasets")
    if not os.path.exists(dataset_dir):
        raise HTTPException(status_code=404, detail="No datasets found.")
        
    files = [f for f in os.listdir(dataset_dir) if f.startswith(req.collection_name) and f.endswith(".jsonl")]
    if not files:
        raise HTTPException(status_code=404, detail="No distilled dataset found for this collection.")
        
    latest_file = sorted(files)[-1]
    file_path = os.path.join(dataset_dir, latest_file)
    
    distiller.update_status("deploying", 95, "Uploading to Hugging Face...")
    
    # Run upload
    result = upload_dataset_to_hf(file_path, req.dataset_name or req.collection_name, req.collection_name)
    
    if "error" in result:
        distiller.update_status("error", 0, result["error"])
        raise HTTPException(status_code=500, detail=result["error"])
        
    distiller.update_status("complete", 100, f"Deployed! {result['url']}")
    return result

@app.post("/distill/reset")
async def reset_distill():
    """Resets the distiller status to idle."""
    distiller.status = {"step": "idle", "progress": 0, "current_task": ""}
    return {"status": "reset"}

@app.get("/list_local_base_models")
async def list_local_base_models():
    """Scans server/models/base_models for downloaded HF repositories."""
    results = []
    # 1. Base Models
    if os.path.exists(MODELS_DIR):
        for d in os.listdir(MODELS_DIR):
            dir_path = os.path.join(MODELS_DIR, d)
            if os.path.isdir(dir_path) and any(f in os.listdir(dir_path) for f in ["config.json", "model.safetensors", "pytorch_model.bin"]):
                results.append({ "id": d.replace('_', '/'), "name": d, "type": "base", "source": "native" })

    # 2. Adapters (Fine-tuned)
    if os.path.exists(ADAPTERS_DIR):
        for d in os.listdir(ADAPTERS_DIR):
            dir_path = os.path.join(ADAPTERS_DIR, d)
            if os.path.isdir(dir_path) and "adapter_config.json" in os.listdir(dir_path):
                results.append({ "id": d, "name": d, "type": "adapter", "source": "native", "lora_slug": d })

    # 3. GGUF (Quantized)
    if os.path.exists(GGUF_DIR):
        for f in os.listdir(GGUF_DIR):
            if f.endswith(".gguf"):
                results.append({ "id": f, "name": f, "type": "gguf", "source": "native" })

    # 4. ONNX Exports (Browser)
    if os.path.exists(ONNX_DIR):
        for d in os.listdir(ONNX_DIR):
            if "_final" in d:
                # Extract precision from folder name (e.g., ..._fp16_final)
                precision = "FP16"
                if "int8" in d.lower(): precision = "INT8"
                if "fp32" in d.lower(): precision = "FP32"
                
                results.append({ 
                    "id": d, 
                    "name": f"{d} ({precision})", 
                    "type": "onnx", 
                    "source": "onnx", 
                    "onnx_slug": d 
                })

    return {"models": results}

@app.get("/list_local_datasets")
async def list_local_datasets():
    """Scans server/data/datasets for .jsonl files and returns them as searchable items."""
    results = []
    if not os.path.exists(DATASETS_DIR):
        return {"datasets": []}
        
    for f in os.listdir(DATASETS_DIR):
        if f.endswith(".jsonl"):
            # example: collection_persona_12345.jsonl -> extract collection
            # Logic: split by underscore and take the first part
            display_name = f.split("_")[0]
            
            # Check file size
            try:
                size_kb = os.path.getsize(os.path.join(DATASETS_DIR, f)) // 1024
            except:
                size_kb = 0
                
            # Check for metadata (HF URL)
            hf_url = None
            meta_path = os.path.join(DATASETS_DIR, f + ".meta")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, 'r') as mf:
                        meta_data = json.load(mf)
                        hf_url = meta_data.get("hf_url")
                except:
                    pass
                
            results.append({
                "id": f, 
                "display_name": display_name,
                "downloads": 0, 
                "likes": 0, 
                "is_local": True,
                "size_kb": size_kb,
                "hf_url": hf_url
            })
    return {"datasets": results}

class DeleteDatasetRequest(BaseModel):
    id: str

@app.post("/delete_dataset")
async def delete_dataset(req: DeleteDatasetRequest):
    """Deletes a local dataset (.jsonl and .meta)."""
    dataset_file = os.path.join(DATASETS_DIR, req.id)
    if os.path.exists(dataset_file):
        try:
            os.remove(dataset_file)
            meta_file = dataset_file + ".meta"
            if os.path.exists(meta_file):
                os.remove(meta_file)
            return {"status": "success", "message": f"Deleted {req.id}"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")
    raise HTTPException(status_code=404, detail="Dataset not found.")

@app.get("/preview_dataset")
async def preview_dataset(id: str):
    """Returns sample rows for a dataset (local JSONL or HF Hub)."""
    samples = []
    # 1. Local JSONL check
    local_path = os.path.join(DATASETS_DIR, id)
    if os.path.exists(local_path) and id.endswith(".jsonl"):
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                for idx, line in enumerate(f):
                    if idx >= 10:
                        break
                    line_data = json.loads(line.strip())
                    samples.append(line_data)
            return {"status": "success", "id": id, "type": "local", "samples": samples, "total_sampled": len(samples)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed reading local dataset: {e}")

    # 2. HF Dataset Preview
    try:
        from datasets import load_dataset
        ds = load_dataset(id, split="train[:5]")
        for item in ds:
            samples.append(item)
        return {"status": "success", "id": id, "type": "hf", "samples": samples, "total_sampled": len(samples)}
    except Exception as e:
        return {"status": "error", "id": id, "type": "unknown", "error": str(e), "samples": []}

def check_dataset_local_presence(dataset_id: str) -> bool:
    if not dataset_id:
        return False
    # Check server/data/datasets/
    if os.path.exists(os.path.join(DATASETS_DIR, dataset_id)):
        return True
    clean_id = dataset_id.replace("/", "_")
    if os.path.exists(os.path.join(DATASETS_DIR, f"{clean_id}.jsonl")):
        return True
    # Check HF Hub cache
    home = os.path.expanduser("~")
    hub_cache = os.path.join(home, ".cache", "huggingface", "hub")
    if "/" in dataset_id:
        parts = dataset_id.split("/")
        cache_slug = f"datasets--{parts[0]}--{parts[1]}"
    else:
        cache_slug = f"datasets--{dataset_id}"
    if os.path.exists(os.path.join(hub_cache, cache_slug)):
        return True
    legacy_cache = os.path.join(home, ".cache", "huggingface", "datasets")
    if os.path.exists(os.path.join(legacy_cache, dataset_id.replace("/", "___"))):
        return True
    return False

@app.get("/dataset_cache_status")
async def get_dataset_cache_status():
    """Returns a map of cached dataset IDs."""
    known_datasets = [
        "lavita/MedQuAD",
        "yahma/alpaca-cleaned",
        "tatsu-lab/alpaca",
        "HuggingFaceH4/instruction-dataset",
        "Open-Orca/OpenOrca",
        "timdettmers/openassistant-guanaco",
        "rotten_tomatoes"
    ]
    status_map = {}
    for d in known_datasets:
        status_map[d] = check_dataset_local_presence(d)
    return {"cached_datasets": status_map}

class DownloadDatasetRequest(BaseModel):
    dataset_id: str

@app.post("/download_hf_dataset")
async def download_hf_dataset(req: DownloadDatasetRequest):
    """Pre-downloads/caches an HF dataset locally."""
    try:
        from datasets import load_dataset
        # Pre-cache first 500 samples
        ds = load_dataset(req.dataset_id, split="train[:500]")
        return {
            "status": "success",
            "message": f"Dataset {req.dataset_id} successfully cached ({len(ds)} items).",
            "dataset_id": req.dataset_id,
            "is_cached": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed downloading dataset: {e}")

if __name__ == "__main__":
    import uvicorn
    # Run server locally on port 8000
    uvicorn.run(app, host="127.0.0.1", port=2000)
