import os
import sys
import json
from huggingface_hub import HfApi, create_repo, login
from dotenv import load_dotenv

def generate_model_card(path: str, repo_id: str, base_model: str, dataset_id: str):
    """
    Generates a README.md (Hugging Face Model Card) if one doesn't exist.
    """
    readme_path = os.path.join(path, "README.md") if os.path.isdir(path) else None
    
    # If it's a file, we can't easily add a README inside it, 
    # but we can upload a separate README to the repo.
    # For simplicity, we create a temporary README if we are uploading a single file.
    
    content = f"""---
license: apache-2.0
base_model: {base_model}
tags:
- vml-studio
- lora
- gguf
- fine-tuned
---

# {repo_id.split('/')[-1]}

This model was fine-tuned and optimized using **Vibe ML Studio**, an agentic local-first training platform.

## 🚀 Model Details
- **Base Model**: [{base_model}](https://huggingface.co/{base_model})
- **Dataset**: {dataset_id}
- **Training Method**: LoRA (Low-Rank Adaptation)
- **Framework**: VML Autonomous SFT Pipeline

## 🛠️ Files Included
- **Adapters**: PEFT weights for use with Transformers/PEFT.
- **GGUF**: Quantized versions optimized for local inference (VML Arena, LM Studio, Ollama).

## ⚡ Powered by VML Studio
Built with [VML Studio](https://github.com/vishnusureshperumbavoor/VML-Studio) - The Agentic ML Workspace.
"""
    if readme_path:
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(content)
        return readme_path
    else:
        # For single files, we return the content so the caller can handle it
        return content

def upload_to_hf(path: str, repo_slug: str, base_model: str = "Unknown", dataset_id: str = "Unknown"):
    """
    Uploads a file or a folder to Hugging Face and generates a Model Card.
    """
    load_dotenv()
    token = os.getenv("HF_TOKEN")
    if not token:
        print("Error: HF_TOKEN not found. Deployment aborted.")
        return False

    api = HfApi(token=token)
    
    try:
        user_info = api.whoami()
        username = user_info['name']
    except Exception as e:
        print(f"Authentication failed: {e}")
        return False

    repo_id = f"{username}/{repo_slug.lower().replace('/', '_')}-vml"
    
    print(f"Preparing repository: {repo_id}...")
    try:
        create_repo(repo_id=repo_id, token=token, private=False, exist_ok=True, repo_type="model")
    except Exception as e:
        print(f"Repo access issue: {e}")

    # Generate README
    print("Generating Model Card (README.md)...")
    readme_content = generate_model_card(path, repo_id, base_model, dataset_id)

    try:
        if os.path.isdir(path):
            print(f"Uploading folder and README to HF...")
            api.upload_folder(
                folder_path=path,
                repo_id=repo_id,
                repo_type="model",
                commit_message=f"VML Build: {repo_slug}"
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
            with open(temp_readme, "w") as f: f.write(readme_content)
            api.upload_file(
                path_or_fileobj=temp_readme,
                path_in_repo="README.md",
                repo_id=repo_id,
                repo_type="model"
            )
            os.remove(temp_readme)
            
        final_url = f"https://huggingface.co/{repo_id}"
        print(f"DEPLOYMENT SUCCESSFUL!")
        print(f"[VML_DEPLOYMENT_URL] {final_url}")
        return True
    except Exception as e:
        print(f"Upload failed: {e}")
        return False

def create_space_for_model(repo_slug: str, base_model: str, adapter_repo_id: str):
    """
    Creates a Gradio Space on Hugging Face for the uploaded model.
    """
    load_dotenv()
    token = os.getenv("HF_TOKEN")
    if not token:
        print("Error: HF_TOKEN not found. Space creation aborted.")
        return False

    api = HfApi(token=token)
    try:
        user_info = api.whoami()
        username = user_info['name']
    except Exception as e:
        print(f"Authentication failed: {e}")
        return False

    space_repo_id = f"{username}/{repo_slug.lower().replace('/', '_')}-assistant"
    
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
        return True
    except Exception as e:
        print(f"Space creation failed: {e}")
        return False

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
