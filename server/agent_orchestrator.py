import asyncio
import os
import sys
import json
import platform
import psutil
from dotenv import load_dotenv

# Enforce UTF-8 for Windows terminal compatibility
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
import mcp.types as types
from huggingface_hub import HfApi, hf_hub_download

# VML RAG Integrations
from rag_service import knowledge_manager, splitter
import rag_ingest

# Load token
load_dotenv()

# Create the MCP Server instance
server = Server("vml-huggingface")

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """List available Hugging Face tools via MCP."""
    return [
        types.Tool(
            name="model_search",
            description="Search for models on the Hugging Face Hub. Returns structured metadata.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "description": "Max results", "default": 5}
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="dataset_search",
            description="Search for datasets on the Hugging Face Hub.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "description": "Max results", "default": 5}
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="start_sft_job",
            description="Generate a Supervised Fine-Tuning (SFT) Python script with LoRA support.",
            inputSchema={
                "type": "object",
                "properties": {
                    "base_model": {"type": "string", "description": "Hugging Face Model ID"},
                    "dataset_id": {"type": "string", "description": "Hugging Face Dataset ID"},
                    "hardware_target": {"type": "string", "description": "Target hardware: 'CPU' or 'GPU'", "default": "CPU"},
                    "max_steps": {"type": "integer", "description": "Total training steps", "default": 300},
                    "rank": {"type": "integer", "description": "LoRA Rank", "default": 16}
                },
                "required": ["base_model", "dataset_id"],
            },
        ),
        types.Tool(
            name="start_quantization_job",
            description="Generate a script to quantize a model to GGUF format for local deployment.",
            inputSchema={
                "type": "object",
                "properties": {
                    "model_id": {"type": "string", "description": "Hugging Face Model ID"},
                    "bits": {"type": "string", "description": "Quantization bits (e.g., '4', '8')", "default": "4"}
                },
                "required": ["model_id"],
            },
        ),
        types.Tool(
            name="get_system_specs",
            description="Get local hardware specifications (CPU, RAM, GPU) for training estimation.",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        types.Tool(
            name="fetch_gguf",
            description="Download a GGUF model file from the Hugging Face Hub directly into the VML models/gguf directory.",
            inputSchema={
                "type": "object",
                "properties": {
                    "repo_id": {"type": "string", "description": "Hugging Face Repo ID (e.g., 'Qwen/Qwen2-0.5B-GGUF')"},
                    "filename": {"type": "string", "description": "Specific GGUF filename (e.g., 'qwen2-0_5b-q8_0.gguf')"}
                },
                "required": ["repo_id", "filename"],
            },
        ),
        types.Tool(
            name="ingest_knowledge",
            description="Mine knowledge from a PDF or URL and index it for semantic search.",
            inputSchema={
                "type": "object",
                "properties": {
                    "source": {"type": "string", "description": "Local path to PDF or a Web URL"},
                    "collection": {"type": "string", "description": "Collection name (e.g., 'HR-Handbook')"}
                },
                "required": ["source", "collection"],
            },
        ),
        types.Tool(
            name="search_knowledge",
            description="Perform a semantic search across a specific knowledge collection.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language query"},
                    "collection": {"type": "string", "description": "Collection to search in"},
                    "limit": {"type": "integer", "description": "Number of results", "default": 3}
                },
                "required": ["query", "collection"],
            },
        ),
        types.Tool(
            name="list_knowledge_collections",
            description="List all available knowledge collections (Vector DBs).",
            inputSchema={"type": "object", "properties": {}},
        ),
        types.Tool(
            name="delete_knowledge_collection",
            description="Delete a collection from the local vector database.",
            inputSchema={
                "type": "object",
                "properties": {
                    "collection": {"type": "string", "description": "Collection name to delete"}
                },
                "required": ["collection"],
            },
        ),
        types.Tool(
            name="explore_knowledge_collection",
            description="Fetch the raw text blocks and metadata from a specific Knowledge Collection.",
            inputSchema={
                "type": "object",
                "properties": {
                    "collection": {"type": "string", "description": "Collection name to explore"},
                    "limit": {"type": "integer", "description": "Max number of blocks to fetch", "default": 50}
                },
                "required": ["collection"],
            },
        )
    ]

@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict | None
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """Handle tool execution requests via MCP."""
    hf_token = os.getenv("HF_TOKEN")
    from huggingface_hub import HfApi
    api = HfApi()
    
    if name == "model_search":
        query = arguments.get("query")
        limit = arguments.get("limit", 5)
        models = api.list_models(search=query, limit=limit, token=hf_token, sort="downloads")
        
        results = []
        for m in models:
            results.append({
                "id": m.id,
                "downloads": getattr(m, "downloads", 0),
                "likes": getattr(m, "likes", 0),
                "gated": getattr(m, "gated", False),
                "lastModified": getattr(m, "lastModified", ""),
                "is_cpu_ready": m.id.split('/')[-1].lower() in ["qwen2-0.5b", "smollm-360m", "tinyllama-1.1b"] or (m.id.count('/') > 0 and '0.5b' in m.id.lower())
            })
        
        return [types.TextContent(type="text", text=f"[JSON_RESULTS]\n{json.dumps(results, indent=2)}")]

    elif name == "dataset_search":
        query = arguments.get("query")
        limit = arguments.get("limit", 5)
        datasets = api.list_datasets(search=query, limit=limit, token=hf_token, sort="downloads", direction=-1)
        
        results = []
        for d in datasets:
            results.append({
                "id": d.id,
                "downloads": getattr(d, "downloads", 0),
                "likes": getattr(d, "likes", 0),
                "gated": getattr(d, "gated", False)
            })
            
        return [types.TextContent(type="text", text=f"[JSON_RESULTS]\n{json.dumps(results, indent=2)}")]

    elif name == "start_sft_job":
        base_model = arguments.get("base_model")
        dataset_id = arguments.get("dataset_id")
        hardware = arguments.get("hardware_target", "CPU")
        max_steps = arguments.get("max_steps", 300)
        rank = arguments.get("rank", 16)
        
        model_name_part = base_model.split('/')[-1].lower().replace('.', '-')
        dataset_name_part = dataset_id.split('/')[-1].lower().replace('.', '-')
        model_slug = f"{model_name_part}-{dataset_name_part}-instruct-vml1"
        
        # Architecture detection for GGUF
        gguf_arch = "llama"
        if "qwen" in base_model.lower():
            gguf_arch = "qwen2"
        elif "gemma" in base_model.lower():
            gguf_arch = "gemma2" if "gemma-2" in base_model.lower() else "gemma"
        elif "mistral" in base_model.lower():
            gguf_arch = "mistral"
        
        # Dynamic path resolution: Detect if we are in 'server/' or project root
        cwd = os.getcwd()
        base_path = cwd if os.path.basename(cwd) == "server" else os.path.join(cwd, "server")
        output_dir = os.path.join(base_path, "models", "adapters", model_slug)
        
        # Split into logical blocks for the notebook
        blocks = [
            f"""# Block 1: Setup and Environment
import os
import torch
import gc
import json
import subprocess
import transformers
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from trl import SFTTrainer, SFTConfig
from peft import LoraConfig, get_peft_model

model_id = "{base_model}"
dataset_id = "{dataset_id}"
hardware = "{hardware}"
max_steps = {max_steps}
rank = {rank}
device = "cuda" if torch.cuda.is_available() and hardware.upper() == "GPU" else "cpu"

# VML-Standard Structure (CWD-Aware)
cwd = os.getcwd()
base_path = cwd if os.path.basename(cwd) == "server" else os.path.join(cwd, "server")
base_models_dir = os.path.join(base_path, "models", "base_models")
os.makedirs(base_models_dir, exist_ok=True)

print(f"Initializing VML SFT Pipeline: {{model_id}} on {{dataset_id}} ({{device}})")
""",
            f"""# Block 2: Model and Tokenizer Loading
from huggingface_hub import snapshot_download
print(f"📥 Acquiring base model weights for {{model_id}}...")
local_model_path = snapshot_download(
    repo_id=model_id,
    local_dir=os.path.join(base_models_dir, model_id.replace('/', '_')),
    ignore_patterns=["*.msgpack", "*.h5", "*.ot", "*.onnx", "framework_specific*"]
)

print("Loading Model and Tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(local_model_path)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

torch_dtype = torch.bfloat16 if device == "cuda" else torch.float32
model = AutoModelForCausalLM.from_pretrained(
    local_model_path,
    device_map=device,
    torch_dtype=torch_dtype,
)

print("Applying LoRA adapter (Rank: {rank})...")
peft_config = LoraConfig(
    r={rank},
    lora_alpha={rank} * 2,
    target_modules="all-linear",
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, peft_config)
model.print_trainable_parameters()
""",
            f"""# Block 3: Dataset Preparation
print("🔍 Locating dataset...")
import os
from datasets import load_dataset

# Robust local path resolution
cwd = os.getcwd()
base_path = cwd if os.path.basename(cwd) == "server" else os.path.join(cwd, "server")
local_path = os.path.join(base_path, "data", "datasets", "{dataset_id}")

if os.path.exists(local_path):
    print(f"📦 Found local dataset: {{local_path}}")
    dataset = load_dataset("json", data_files=local_path, split="train[:500]")
else:
    if {repr(dataset_id)}.endswith((".jsonl", ".json", ".csv")):
        print(f"❌ Local file not found at {{local_path}}. Since it has a file extension, skipping HF Hub fallback.")
        raise FileNotFoundError(f"Local dataset {{local_path}} not found.")
    
    print(f"🌐 Local dataset not found. Attempting to fetch from Hugging Face: {repr(dataset_id)}")
    dataset = load_dataset({repr(dataset_id)}, split="train[:500]")

def get_universal_format(example):
    input_keys = ["instruction", "prompt", "query", "question", "input"]
    output_keys = ["output", "response", "answer", "target"]
    if "messages" in example:
        return {{"text": tokenizer.apply_chat_template(example["messages"], tokenize=False, add_generation_prompt=False)}}
    instr = next((example[k] for k in input_keys if k in example), "")
    out = next((example[k] for k in output_keys if k in example), "")
    context = example.get("input", "") if "instruction" in example else ""
    return {{"text": f"### Instruction:\\n{{instr}}\\n\\n### Input:\\n{{context}}\\n\\n### Response:\\n{{out}}"}}

print("🛠️ Mapping dataset to instructions...")
dataset = dataset.map(get_universal_format)
""",
            f"""# Block 4: Training Execution
class VMLReportingCallback(transformers.TrainerCallback):
    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs:
            logs["vml_step"] = state.global_step
            logs["vml_epoch"] = state.epoch
            logs["vml_total_steps"] = state.max_steps
            print(f"[VML_DATA] {{json.dumps(logs)}}")

# Resolve output path dynamically
cwd = os.getcwd()
base_path = cwd if os.path.basename(cwd) == "server" else os.path.join(cwd, "server")
output_dir = os.path.join(base_path, "models", "adapters", "{model_slug}")

sft_config = SFTConfig(
    output_dir=output_dir,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=4,
    learning_rate=5e-4,
    num_train_epochs=15,
    logging_steps=1,
    max_steps=max_steps,
    report_to="none",
    save_strategy="no",
    dataset_text_field="text",
    fp16=False,
    bf16=False,
    packing=False,
)

trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    args=sft_config,
    processing_class=tokenizer,
    callbacks=[VMLReportingCallback()]
)

print("Starting training loop...")
# Ensure output directory exists before training
os.makedirs(output_dir, exist_ok=True)
trainer.train()
""",
            f"""# Block 5: Export and Weights Persistence
print(f"Saving fine-tuned adapters to {{output_dir}}...")
trainer.save_model(output_dir)
print("✅ Local weights stored successfully.")
""",
            f"""# Block 5.1: GGUF Engine Provisioning
vml_script_path = os.path.join(output_dir, "vml_converter_engine.py")
vml_code = r'''
import os, json, torch, gguf, sys
from safetensors.torch import load_file

def convert(adapter_path, output_path):
    print(f"🚀 VML Native Engine: Starting conversion...")
    with open(os.path.join(adapter_path, "adapter_config.json"), "r") as f: cfg = json.load(f)
    w_path = os.path.join(adapter_path, "adapter_model.safetensors")
    weights = load_file(w_path) if os.path.exists(w_path) else torch.load(os.path.join(adapter_path, "adapter_model.bin"), map_location="cpu")
    writer = gguf.GGUFWriter(output_path, "{gguf_arch}")
    writer.add_string("general.type", "adapter")
    writer.add_string("adapter.type", "lora")
    writer.add_float32("adapter.lora.alpha", float(cfg.get("lora_alpha", 16.0)))
    vml_map = {{"q_proj": "attn_q", "k_proj": "attn_k", "v_proj": "attn_v", "o_proj": "attn_output", "gate_proj": "ffn_gate", "up_proj": "ffn_up", "down_proj": "ffn_down"}}
    for k, v in weights.items():
        if "lora_" not in k: continue
        parts = k.split(".")
        if "layers" not in parts: continue
        layer_idx = parts[parts.index("layers") + 1]
        target = parts[parts.index("layers") + 3]
        lora_part = "lora_a" if "lora_A" in k else "lora_b"
        gguf_name = f"blk.{{layer_idx}}.{{vml_map.get(target, target)}}.weight.{{lora_part}}"
        writer.add_tensor(gguf_name, v.numpy())
    writer.write_header_to_file()
    writer.write_kv_data_to_file()
    writer.write_tensors_to_file()
    writer.close()
    print("✅ GGUF Adapter generated.")

if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2])
'''
open(vml_script_path, "w", encoding="utf-8").write(vml_code)
print(f"Converter engine provisioned at: {{vml_script_path}}")
""",
            f"""# Block 5.2: Isolated GGUF Conversion
import sys, subprocess
vml_out = os.path.join(output_dir, "adapter.gguf")
vml_script = os.path.join(output_dir, "vml_converter_engine.py")
print("--- Launching Isolated Conversion ---")
subprocess.run([sys.executable, vml_script, output_dir, vml_out], check=True)
""",
            f"""# Block 6: Autonomous HF Deployment
import sys
import os
sys.path.append(os.path.join(os.getcwd(), "server"))
try:
    from hf_uploader import upload_to_hf, create_space_for_model
    from huggingface_hub import HfApi
    
    # Conditional logic: Only deploy if it's a real training run (>= 300 steps)
    if sft_config.max_steps >= 300:
        print("[VML AGENT] Training target met (>= 300 steps). Initiating Autonomous Deployment...")
        
        # 1. Upload to Hugging Face
        success = upload_to_hf(output_dir, {repr(model_slug)}, {repr(base_model)}, {repr(dataset_id)})
        
        if success:
            # 2. Resolve Repo ID for Space
            api = HfApi()
            username = api.whoami()["name"]
            repo_id = f"{{username}}/{model_slug.lower().replace('/', '_')}-vml"
            
            # 3. Create Space
            create_space_for_model({repr(model_slug)}, {repr(base_model)}, repo_id)
        else:
            print("Deployment failed.")
    else:
        print(f"[VML AGENT] Training run of {{sft_config.max_steps}} steps is below deployment threshold (300). Skipping HF upload.")
except ImportError:
    print("hf_uploader.py not found in server/. Skipping automated deployment.")
except Exception as e:
    print(f"Autonomous deployment agent failed: {{e}}")
""",
            f"""# Block 7: VML Agentic Handoff
import json
vml_handoff = {{"vml_type": "HANDOFF_SFT_COMPLETE", "adapter_dir": output_dir, "model_slug": {repr(model_slug)}, "base_model": {repr(base_model)}, "dataset_id": {repr(dataset_id)}}}
print(f"[VML_HANDOFF] {{json.dumps(vml_handoff)}}")
"""
        ]
        
        blocks_json = json.dumps(blocks)
        return [types.TextContent(type="text", text=f"[VML_BLOCKS]\n{blocks_json}")]

    elif name == "start_quantization_job":
        model_id = arguments.get("model_id")
        bits = arguments.get("bits", "4")
        model_name_clean = model_id.split('/')[-1]
        target_filename = f"{model_name_clean.lower()}-q{bits}_0.gguf"
        
        blocks = [
            f"""# Block 1: Environment & Configuration
import os
import sys
import subprocess

model_id = "{model_id}"
bits = "{bits}"
target_filename = "{target_filename}"
# VML-Standard Structure (CWD-Aware)
cwd = os.getcwd()
base_path = cwd if os.path.basename(cwd) == "server" else os.path.join(cwd, "server")
gguf_dir = os.path.join(base_path, "models", "gguf")
base_models_dir = os.path.join(base_path, "models", "base_models")

os.makedirs(gguf_dir, exist_ok=True)
os.makedirs(base_models_dir, exist_ok=True)

print(f"🛠️ Starting VML Quantization Pipeline: {{model_id}} -> {{bits}}-bit GGUF")
""",
            f"""# Block 2: Base Model Acquisition (with Progress Tracking)
from huggingface_hub import snapshot_download
import json

class VMLProgress:
    def __init__(self, *args, **kwargs):
        self.total = kwargs.get('total', 100)
        self.n = 0
    def update(self, n):
        self.n += n
        pct = min(100, int((self.n / self.total) * 100))
        print(f"[VML_DATA] {{'type': 'progress', 'percentage': {{pct}}}}")
    def close(self): pass
    def __enter__(self): return self
    def __exit__(self, *args): pass

print(f"📥 Fetching {{model_id}} weights...")

source_path = snapshot_download(
    repo_id=model_id, 
    local_dir=os.path.join(base_models_dir, model_id.replace('/', '_')),
    ignore_patterns=["*.msgpack", "*.h5", "*.ot", "*.onnx", "framework_specific*"],
    tqdm_class=VMLProgress
)
print(f"✅ Model weights ready at: {{source_path}}")
""",
            f"""# Block 3: Quantization & LoRA Tooling Setup
print("📦 Checking conversion tools...")
tools_cache = os.path.join(os.getcwd(), "server", ".cache", "vml-tools")
os.makedirs(tools_cache, exist_ok=True)
converter_script = os.path.join(tools_cache, "convert_hf_to_gguf.py")
lora_converter_script = os.path.join(tools_cache, "convert_lora_to_gguf.py")

import urllib.request
def fetch_tool(name, url, path):
    if not os.path.exists(path):
        print(f"📥 Fetching {{name}}...")
        urllib.request.urlretrieve(url, path)
        print(f"✅ {{name}} prepared.")
    else:
        print(f"✅ {{name}} already present.")

fetch_tool("HF-to-GGUF Converter", "https://raw.githubusercontent.com/ggerganov/llama.cpp/master/convert_hf_to_gguf.py", converter_script)
fetch_tool("LoRA-to-GGUF Converter", "https://raw.githubusercontent.com/ggerganov/llama.cpp/master/convert_lora_to_gguf.py", lora_converter_script)
""",
            f"""# Block 4: GGUF Model Conversion
output_path = os.path.join(gguf_dir, target_filename)
print(f"🔄 Converting weights to {{bits}}-bit GGUF...")

try:
    subprocess.run([
        sys.executable, converter_script, 
        source_path, 
        "--outtype", f"q{{bits}}_0", 
        "--outfile", output_path
    ], check=True)
    print(f"✅ Quantization successfully completed: {{output_path}}")
except Exception as e:
    print(f"❌ Quantization failed: {{e}}")
    sys.exit(1)
""",
            f"""# Block 5: Unified Cloud Deployment (DISABLED FOR TESTING)
print("🚀 Cloud Deployment is currently DISABLED in testing mode.")
# import sys
# sys.path.append(os.path.join(os.getcwd(), "server"))
# try:
#     from hf_uploader import upload_to_hf
#     # Upload the single GGUF file to the same repo with metadata
#     upload_to_hf(output_path, "{model_name_clean.lower()}", "{model_id}", "Fine-tuned VML Dataset")
# except ImportError:
#     print("⚠️ hf_uploader.py not found. Skipping cloud deployment.")
# except Exception as e:
#     print("❌ Deployment failed: {{e}}")

print("🏁 VML Quantization Pipeline Complete.")
"""
        ]
        
        blocks_json = json.dumps(blocks)
        return [types.TextContent(type="text", text=f"[VML_BLOCKS]\n{blocks_json}")]

    elif name == "fetch_gguf":
        repo_id = arguments.get("repo_id")
        filename = arguments.get("filename")
        base_dir = os.path.dirname(os.path.abspath(__file__))
        # Update point: Downloads now go to server/models/gguf
        target_dir = os.path.join(base_dir, "models", "gguf")
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
            
        try:
            path = hf_hub_download(
                repo_id=repo_id, 
                filename=filename, 
                local_dir=target_dir,
                token=hf_token
            )
            return [types.TextContent(type="text", text=f"✅ Model downloaded successfully to: {path}")]
        except Exception as e:
            return [types.TextContent(type="text", text=f"❌ Download failed: {str(e)}")]

    elif name == "ingest_knowledge":
        source = arguments.get("source")
        collection = arguments.get("collection")
        
        try:
            if source.startswith("http"):
                report = rag_ingest.ingest_link(source, collection)
            else:
                report = rag_ingest.ingest_pdf(source, collection)
                
            if "error" in report:
                return [types.TextContent(type="text", text=f"❌ Ingestion failed: {report['error']}")]
                
            stats = {
                "report": report,
                "total_storage_mb": knowledge_manager.get_storage_stats()
            }
            return [types.TextContent(type="text", text=f"[JSON_RESULTS]\n{json.dumps(stats, indent=2)}")]
        except Exception as e:
            return [types.TextContent(type="text", text=f"❌ Ingestion failed: {str(e)}")]

    elif name == "search_knowledge":
        query = arguments.get("query")
        collection = arguments.get("collection")
        limit = arguments.get("limit", 3)
        
        try:
            results = knowledge_manager.search(collection, query, limit=limit)
            return [types.TextContent(type="text", text=f"[JSON_RESULTS]\n{json.dumps(results, indent=2)}")]
        except Exception as e:
            return [types.TextContent(type="text", text=f"❌ Search failed: {str(e)}")]

    elif name == "list_knowledge_collections":
        try:
            collections = knowledge_manager.list_collections()
            stats = {
                "collections": collections,
                "total_storage_mb": knowledge_manager.get_storage_stats()
            }
            return [types.TextContent(type="text", text=f"[JSON_RESULTS]\n{json.dumps(stats, indent=2)}")]
        except Exception as e:
            return [types.TextContent(type="text", text=f"❌ Failed to list collections: {str(e)}")]

    elif name == "delete_knowledge_collection":
        collection = arguments.get("collection")
        try:
            knowledge_manager.delete_collection(collection)
            stats = {"total_storage_mb": knowledge_manager.get_storage_stats()}
            return [types.TextContent(type="text", text=f"[JSON_RESULTS]\n{json.dumps(stats)}")]
        except Exception as e:
            return [types.TextContent(type="text", text=f"❌ Delete failed: {str(e)}")]

    elif name == "explore_knowledge_collection":
        collection = arguments.get("collection")
        limit = arguments.get("limit", 50)
        try:
            results = knowledge_manager.explore_collection(collection, limit=limit)
            return [types.TextContent(type="text", text=f"[JSON_RESULTS]\n{json.dumps(results, indent=2)}")]
        except Exception as e:
            return [types.TextContent(type="text", text=f"❌ Exploration failed: {str(e)}")]

    elif name == "get_system_specs":
        cpu_count = psutil.cpu_count(logical=True)
        ram_total = round(psutil.virtual_memory().total / (1024**3), 2)
        gpu_info = {"available": False, "name": "N/A", "vram_gb": 0}
        
        try:
            has_gpu_env = os.system("nvidia-smi > nul 2>&1") == 0
            if has_gpu_env:
                import torch
                if torch.cuda.is_available():
                    gpu_info = {
                        "available": True,
                        "name": torch.cuda.get_device_name(0),
                        "vram_gb": round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)
                    }
        except:
            pass
        
        specs = {
            "os": platform.system(),
            "cpu_threads": cpu_count,
            "ram_gb": ram_total,
            "gpu": gpu_info
        }
        
        return [types.TextContent(type="text", text=f"[JSON_RESULTS]\n{json.dumps(specs, indent=2)}")]

    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="vml-huggingface",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
