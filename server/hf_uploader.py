import os
import sys
import json
from huggingface_hub import HfApi, create_repo, login
from dotenv import load_dotenv

def resolve_hf_model_id(raw_base_model: str) -> str:
    """
    Maps local filesystem paths or directory names to official Hugging Face repository IDs.
    e.g. '/home/vsp/.../Qwen_Qwen2-0.5B' -> 'Qwen/Qwen2-0.5B'
    """
    if not raw_base_model:
        return "Qwen/Qwen2-0.5B"
    
    s = raw_base_model.replace('\\', '/').strip().strip('"').strip("'")
    
    if "qwen2-0.5b" in s.lower() or "qwen2-0_5b" in s.lower() or "qwen2" in s.lower():
        return "Qwen/Qwen2-0.5B"
    elif "qwen2.5" in s.lower():
        return "Qwen/Qwen2.5-0.5B"
    elif "bonsai" in s.lower():
        return "prism-ml/Bonsai-1.7B-unpacked"
    elif "smollm" in s.lower():
        return "HuggingFaceTB/SmolLM-135M"
    elif "phi-3" in s.lower() or "phi3" in s.lower():
        return "microsoft/Phi-3-mini-4k-instruct"
    elif "gemma-2" in s.lower() or "gemma2" in s.lower():
        return "google/gemma-2-2b"
    elif "llama-3" in s.lower() or "llama3" in s.lower():
        return "meta-llama/Meta-Llama-3-8B"
    
    basename = s.split('/')[-1]
    if "_" in basename:
        parts = basename.split("_", 1)
        return f"{parts[0]}/{parts[1]}"
    
    return "Qwen/Qwen2-0.5B"

def generate_model_card(path: str, repo_id: str, base_model: str, dataset_id: str, epochs: int = 300, rank: int = 16):
    """
    Generates a rich README.md (Hugging Face Model Card) for fine-tuned LoRA models.
    """
    hf_base_model = resolve_hf_model_id(base_model)
    readme_path = os.path.join(path, "README.md") if os.path.isdir(path) else None
    dataset_tag = dataset_id.split('/')[-1].lower().replace('_', '-')
    
    content = f"""---
license: apache-2.0
base_model: {hf_base_model}
tags:
- vml-studio
- lora
- peft
- sft
- gguf
- fine-tuned
- {dataset_tag}
pipeline_tag: text-generation
---

# {repo_id.split('/')[-1]}

Fine-tuned LoRA domain model trained on **{dataset_id}** for **{epochs} epochs** using [Vibe ML Studio](https://github.com/vishnusureshperumbavoor/VML-Studio).

## 🚀 Model Details
- **Architecture**: LoRA Adapter for `{hf_base_model}`
- **Base Model**: [{hf_base_model}](https://huggingface.co/{hf_base_model})
- **Dataset**: `{dataset_id}`
- **Training Epochs**: `{epochs}`
- **LoRA Rank ($r$)**: `{rank}`
- **LoRA Alpha ($\alpha$)**: `32`
- **Target Modules**: `q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj`
- **Inference Engine**: VML Arena, PEFT / Transformers, llama.cpp / GGUF

## 🛠️ Files Included
- `adapter_model.safetensors`: Low-rank weight matrices (PyTorch / PEFT).
- `adapter_config.json`: PEFT configuration for standard Hugging Face loaders.
- `{repo_id.split('/')[-1]}-adapter.gguf`: Quantized format for 1-click local native execution in VML Studio & llama.cpp.

## 💻 Quickstart Inference (Python / PEFT)
```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model_id = "{hf_base_model}"
peft_model_id = "{repo_id}"

tokenizer = AutoTokenizer.from_pretrained(base_model_id)
base_model = AutoModelForCausalLM.from_pretrained(
    base_model_id,
    torch_dtype=torch.float16,
    device_map="auto"
)
model = PeftModel.from_pretrained(base_model, peft_model_id)

prompt = "Hello! Tell me about yourself."
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=128)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

## ⚡ Powered by Vibe ML Studio
Autonomous agentic fine-tuning, quantization, and local deployment workspace.
"""
    if readme_path:
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(content)
        return readme_path
    else:
        return content

def _load_hf_token():
    for env_path in [
        ".env",
        "../.env",
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        "/home/vsp/projects/Vibe-ML-Studio/.env"
    ]:
        if os.path.exists(env_path):
            load_dotenv(env_path, override=True)
            break
    else:
        load_dotenv(override=True)
    
    tok = os.getenv("HF_TOKEN")
    if tok:
        tok = tok.strip().strip('"').strip("'").strip()
        if tok.startswith("export "):
            tok = tok.replace("export ", "").split("=")[-1].strip().strip('"').strip("'")
    return tok or None

def upload_to_hf(path: str, repo_slug: str, base_model: str = "Unknown", dataset_id: str = "Unknown", epochs: int = 300, rank: int = 16, is_private: bool = False, progress_callback=None):
    """
    Uploads a file or a folder to Hugging Face and generates a Model Card with training specs.
    """
    if progress_callback:
        progress_callback(10, "Authenticating with Hugging Face Hub...")

    token = _load_hf_token()
    if not token:
        print("Error: HF_TOKEN not found. Deployment aborted.")
        return {"success": False, "error": "HF_TOKEN not found in .env. Please set HF_TOKEN in your environment or .env file."}

    api = HfApi(token=token)
    
    try:
        user_info = api.whoami()
        username = user_info.get('name') or user_info.get('username') or "user"
    except Exception as e:
        print(f"Authentication failed: {e}")
        return {"success": False, "error": f"Hugging Face authentication failed: {str(e)}"}

    clean_slug = repo_slug.lower().replace('/', '_').replace(' ', '-').strip('-')
    # Strip any leading base-model prefix
    for p in ["qwen2-0-5b-", "qwen2-", "qwen-", "bonsai-1-7b-", "bonsai-"]:
        if clean_slug.startswith(p):
            clean_slug = clean_slug[len(p):]
            break
    
    repo_id = f"{username}/{clean_slug}"
    if not repo_id.endswith("-vml") and not "-vml" in repo_id:
        repo_id = f"{repo_id}-vml"
    
    if progress_callback:
        progress_callback(25, f"Creating Hugging Face repository: @{repo_id}...")

    print(f"Preparing repository: {repo_id}...")
    try:
        create_repo(repo_id=repo_id, token=token, private=is_private, exist_ok=True, repo_type="model")
    except Exception as e:
        print(f"Repo access/creation note: {e}")

    valid_hf_base = resolve_hf_model_id(base_model)

    if progress_callback:
        progress_callback(40, "Sanitizing PEFT config & generating Model Card...")

    # Sanitize adapter_config.json if it contains a local filesystem path
    if os.path.isdir(path):
        cfg_path = os.path.join(path, "adapter_config.json")
        if os.path.exists(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as cf:
                    cfg_json = json.load(cf)
                cfg_json["base_model_name_or_path"] = valid_hf_base
                with open(cfg_path, "w", encoding="utf-8") as cf:
                    json.dump(cfg_json, cf, indent=2)
            except Exception as e:
                print(f"adapter_config.json sanitize note: {e}")

        # Ensure ONLY 1 clean model-named GGUF file exists for the upload
        adapter_gguf_path = os.path.join(path, "adapter.gguf")
        named_gguf_name = f"{clean_slug}-adapter.gguf"
        named_gguf_path = os.path.join(path, named_gguf_name)
        if os.path.exists(adapter_gguf_path):
            try:
                if not os.path.exists(named_gguf_path):
                    os.rename(adapter_gguf_path, named_gguf_path)
                else:
                    os.remove(adapter_gguf_path)
            except Exception as e:
                print(f"Named GGUF rename note: {e}")

    # Generate / Overwrite Model Card (README.md) with valid HF base model
    print(f"Generating Model Card for {valid_hf_base}...")
    readme_content = generate_model_card(path, repo_id, valid_hf_base, dataset_id, epochs=epochs, rank=rank)

    if progress_callback:
        progress_callback(60, "Uploading PEFT weights, GGUF adapter & tokenizers...")

    try:
        if os.path.isdir(path):
            print(f"Uploading folder and README to HF ({repo_id})...")
            api.upload_folder(
                folder_path=path,
                repo_id=repo_id,
                repo_type="model",
                commit_message=f"VML Fine-Tuned Model: {clean_slug} ({epochs} Epochs)"
            )
        else:
            print(f"Uploading model file and auto-generated README...")
            # Upload the main file
            api.upload_file(
                path_or_fileobj=path,
                path_in_repo=os.path.basename(path),
                repo_id=repo_id,
                repo_type="model"
            )
            # Upload the README as a separate action for single-file uploads
            temp_readme = "TEMP_README.md"
            with open(temp_readme, "w", encoding="utf-8") as f:
                f.write(readme_content)
            api.upload_file(
                path_or_fileobj=temp_readme,
                path_in_repo="README.md",
                repo_id=repo_id,
                repo_type="model"
            )
            if os.path.exists(temp_readme):
                os.remove(temp_readme)
            
        final_url = f"https://huggingface.co/{repo_id}"
        print(f"DEPLOYMENT SUCCESSFUL!")
        print(f"[VML_DEPLOYMENT_URL] {final_url}")
        
        if progress_callback:
            progress_callback(85, "Adapter weights uploaded successfully!")

        return {"success": True, "repo_id": repo_id, "url": final_url, "username": username}
    except Exception as e:
        print(f"Upload failed: {e}")
        return {"success": False, "error": f"Upload failed: {str(e)}"}

def create_space_for_model(repo_slug: str, base_model: str, adapter_repo_id: str, progress_callback=None):
    """
    Creates a Gradio Space on Hugging Face for the uploaded model.
    """
    if progress_callback:
        progress_callback(90, "Deploying interactive Gradio Space Demo...")

    token = _load_hf_token()
    if not token:
        print("Error: HF_TOKEN not found. Space creation aborted.")
        return {"success": False, "error": "HF_TOKEN not found."}

    api = HfApi(token=token)
    try:
        user_info = api.whoami()
        username = user_info.get('name') or user_info.get('username') or "user"
    except Exception as e:
        print(f"Authentication failed: {e}")
        return {"success": False, "error": f"Auth failed: {str(e)}"}

    clean_slug = repo_slug.lower().replace('/', '_').replace(' ', '-')
    space_repo_id = f"{username}/{clean_slug}-assistant"
    
    print(f"Creating Hugging Face Space: {space_repo_id}...")
    try:
        create_repo(
            repo_id=space_repo_id, 
            token=token, 
            repo_type="space", 
            space_sdk="gradio", 
            exist_ok=True
        )
    except Exception as e:
        print(f"Space create note: {e}")

    # Generate app.py for the Space
    app_py_content = f"""import gradio as gr
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model_id = "{base_model}"
peft_model_id = "{adapter_repo_id}"

print("Loading base model & adapter...")
tokenizer = AutoTokenizer.from_pretrained(base_model_id)
base_model = AutoModelForCausalLM.from_pretrained(
    base_model_id,
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    device_map="auto" if torch.cuda.is_available() else None
)
model = PeftModel.from_pretrained(base_model, peft_model_id)
model.eval()

def chat(message, history):
    prompt = f"User: {{message}}\\nAssistant:"
    inputs = tokenizer(prompt, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = inputs.to("cuda")
    
    with torch.no_grad():
        outputs = model.generate(**inputs, max_new_tokens=150, do_sample=True, temperature=0.7)
    
    response = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
    return response

demo = gr.ChatInterface(
    fn=chat, 
    title="{clean_slug.replace('-', ' ').title()} - AI Assistant",
    description="Fine-tuned LoRA model deployed directly with VML Studio."
)

if __name__ == "__main__":
    demo.launch()
"""
    try:
        temp_app = "TEMP_app.py"
        with open(temp_app, "w", encoding="utf-8") as f:
            f.write(app_py_content)
        api.upload_file(
            path_or_fileobj=temp_app,
            path_in_repo="app.py",
            repo_id=space_repo_id,
            repo_type="space"
        )
        if os.path.exists(temp_app):
            os.remove(temp_app)
            
        space_url = f"https://huggingface.co/spaces/{space_repo_id}"
        print(f"Space created at: {space_url}")
        
        if progress_callback:
            progress_callback(98, "Gradio Space demo deployed successfully!")
            
        return {"success": True, "space_url": space_url, "space_repo_id": space_repo_id}
    except Exception as e:
        print(f"Failed to populate Space app.py: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # Args: path, repo_slug, base_model, dataset_id
    path = sys.argv[1] if len(sys.argv) > 1 else None
    slug = sys.argv[2] if len(sys.argv) > 2 else None
    base = sys.argv[3] if len(sys.argv) > 3 else "Unknown"
    ds = sys.argv[4] if len(sys.argv) > 4 else "Unknown"
    
    if not path or not slug:
        print("Usage: python hf_uploader.py <path> <repo_slug> [base_model] [dataset_id]")
    else:
        upload_to_hf(path, slug, base, ds)

