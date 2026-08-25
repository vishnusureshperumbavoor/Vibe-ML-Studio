import os
import sys
import json
from huggingface_hub import HfApi, create_repo, login
from dotenv import load_dotenv

def generate_model_card(path: str, repo_id: str, base_model: str, dataset_id: str, epochs: int = 300, rank: int = 16):
    """
    Generates a rich README.md (Hugging Face Model Card) for fine-tuned LoRA models.
    """
    clean_base = base_model.replace('_', '/').split('/')[-1]
    readme_path = os.path.join(path, "README.md") if os.path.isdir(path) else None
    
    content = f"""---
license: apache-2.0
base_model: {clean_base}
tags:
- vml-studio
- lora
- peft
- sft
- gguf
- fine-tuned
- {dataset_id.split('/')[-1].lower()}
pipeline_tag: text-generation
---

# {repo_id.split('/')[-1]}

Fine-tuned LoRA domain model trained on **{dataset_id}** for **{epochs} epochs** using [Vibe ML Studio](https://github.com/vishnusureshperumbavoor/VML-Studio).

## 🚀 Model Details
- **Architecture**: LoRA Adapter for `{clean_base}`
- **Base Model**: [{base_model}](https://huggingface.co/{base_model})
- **Dataset**: `{dataset_id}`
- **Training Epochs**: `{epochs}`
- **LoRA Rank ($r$)**: `{rank}`
- **LoRA Alpha ($\alpha$)**: `32`
- **Target Modules**: `q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj`
- **Inference Engine**: VML Arena, PEFT / Transformers, llama.cpp / GGUF

## 🛠️ Files Included
- `adapter_model.safetensors`: Low-rank weight matrices.
- `adapter_config.json`: PEFT configuration for standard Hugging Face loaders.
- `adapter.gguf`: Quantized format for 1-click local native execution in VML Studio & llama.cpp.

## 💻 Quickstart Inference (Python / PEFT)
```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model_id = "{base_model}"
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

def upload_to_hf(path: str, repo_slug: str, base_model: str = "Unknown", dataset_id: str = "Unknown", epochs: int = 300, rank: int = 16, is_private: bool = False):
    """
    Uploads a file or a folder to Hugging Face and generates a Model Card with training specs.
    """
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
    
    print(f"Preparing repository: {repo_id}...")
    try:
        create_repo(repo_id=repo_id, token=token, private=is_private, exist_ok=True, repo_type="model")
    except Exception as e:
        print(f"Repo access/creation note: {e}")

    # Generate README
    print("Generating Model Card (README.md)...")
    readme_content = generate_model_card(path, repo_id, base_model, dataset_id, epochs=epochs, rank=rank)

    try:
        if os.path.isdir(path):
            print(f"Uploading folder and README to HF ({repo_id})...")
            api.upload_folder(
                folder_path=path,
                repo_id=repo_id,
                repo_type="model",
                commit_message=f"VML Fine-Tuned Model: {repo_slug}"
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
        return {"success": True, "repo_id": repo_id, "url": final_url, "username": username}
    except Exception as e:
        print(f"Upload failed: {e}")
        return {"success": False, "error": f"Upload failed: {str(e)}"}

def create_space_for_model(repo_slug: str, base_model: str, adapter_repo_id: str):
    """
    Creates a Gradio Space on Hugging Face for the uploaded model.
    """
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
            private=False, 
            exist_ok=True
        )
        
        # Generate app.py content
        app_content = f'''
import gradio as gr
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

model_id = "{base_model}"
adapter_id = "{adapter_repo_id}"

print("Loading model and adapter...")
tokenizer = AutoTokenizer.from_pretrained(model_id)
base_model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=torch.float32, device_map="cpu")
model = PeftModel.from_pretrained(base_model, adapter_id)
print("Model ready!")

def chat(message, history):
    prompt = f"<|im_start|>user\\n{{message}}<|im_end|>\\n<|im_start|>assistant\\n"
    inputs = tokenizer(prompt, return_tensors="pt")
    with torch.no_grad():
        outputs = model.generate(**inputs, max_new_tokens=512, temperature=0.7, top_p=0.9, eos_token_id=tokenizer.eos_token_id)
    response = tokenizer.decode(outputs[0][len(inputs["input_ids"][0]):], skip_special_tokens=True)
    return response

demo = gr.ChatInterface(fn=chat, title="VML AI Assistant: {repo_slug}", description="Fine-tuned model deployed via Vibe ML Studio.")
if __name__ == "__main__":
    demo.launch()
'''
        # Generate requirements.txt content
        req_content = "torch\ntransformers\npeft\ngradio\naccelerate\nsentencepiece\n"

        # Upload files
        api.upload_file(
            path_or_fileobj=app_content.encode("utf-8"),
            path_in_repo="app.py",
            repo_id=space_repo_id,
            repo_type="space"
        )
        api.upload_file(
            path_or_fileobj=req_content.encode("utf-8"),
            path_in_repo="requirements.txt",
            repo_id=space_repo_id,
            repo_type="space"
        )
        
        space_url = f"https://huggingface.co/spaces/{space_repo_id}"
        print(f"SPACE DEPLOYED SUCCESSFULLY!")
        print(f"[VML_SPACE_URL] {space_url}")
        return {"success": True, "space_url": space_url}
    except Exception as e:
        print(f"Space creation failed: {e}")
        return {"success": False, "error": f"Space creation failed: {str(e)}"}

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

