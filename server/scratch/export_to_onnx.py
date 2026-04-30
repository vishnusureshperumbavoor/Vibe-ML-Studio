import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from optimum.onnxruntime import ORTModelForCausalLM
from huggingface_hub import HfApi, login
from dotenv import load_dotenv

# Load environment variables from the root .env
# Path logic: d:\Projects\VML-Studio-Upgraded\server\scratch\export_to_onnx.py
# We need to go up 3 levels to reach d:\Projects\VML-Studio-Upgraded\
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(root_dir, ".env"))
token = os.getenv("HF_TOKEN")
if token:
    login(token=token)
else:
    print(f"⚠️ HF_TOKEN not found in {os.path.join(root_dir, '.env')}. Please ensure you are logged in via hf-cli.")

# Paths - Adjusted to match your specific workspace paths
base_model_path = r"d:\Projects\VML-Studio-Upgraded\server\models\base_models\Qwen_Qwen2-0.5B"
adapter_path = r"d:\Projects\VML-Studio-Upgraded\server\models\adapters\qwen2-0-5b-trenser_distilled_1776793858-jsonl-instruct-vml1"
export_root = r"d:\Projects\VML-Studio-Upgraded\server\models\onnx_export"
repo_id = "vishnusureshperumbavoor/qwen2-0-5b-trenser-distilled-vml"

temp_merged_dir = os.path.join(export_root, "temp_merged")
onnx_output_dir = os.path.join(export_root, "onnx")

os.makedirs(temp_merged_dir, exist_ok=True)
os.makedirs(onnx_output_dir, exist_ok=True)

# 1. Load and Merge
print("--- Step 1: Loading and Merging Model ---")
print(f"Loading base model: {base_model_path}")
try:
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_path, 
        torch_dtype=torch.float32,
        device_map=None,
        trust_remote_code=True
    )
    print(f"Loading adapter: {adapter_path}")
    model = PeftModel.from_pretrained(base_model, adapter_path)

    print("Merging weights (LoRA -> Base)...")
    merged_model = model.merge_and_unload()

    print(f"Saving merged model temporarily to: {temp_merged_dir}")
    merged_model.save_pretrained(
        temp_merged_dir, 
        safe_serialization=False  # Sometimes avoids issues with specific architecture metadata
    )
    print(f"Loading tokenizer from: {base_model_path}")
    tokenizer = AutoTokenizer.from_pretrained(base_model_path, trust_remote_code=True)
    tokenizer.save_pretrained(temp_merged_dir)
except Exception as e:
    import traceback
    print(f"❌ Error during merging: {e}")
    traceback.print_exc()
    exit(1)

# 2. Export to ONNX
print("\n--- Step 2: Exporting to ONNX ---")
print(f"Exporting to: {onnx_output_dir}")
try:
    # This will handle the conversion using Optimum
    ort_model = ORTModelForCausalLM.from_pretrained(temp_merged_dir, export=True)
    ort_model.save_pretrained(onnx_output_dir)
    print("✅ ONNX export successful!")
except Exception as e:
    print(f"❌ ONNX export failed: {e}")
    exit(1)

# 3. Upload to Hugging Face
print("\n--- Step 3: Uploading to Hugging Face ---")
print(f"Target Repository: {repo_id}")
api = HfApi()

try:
    # We upload the onnx folder content to an 'onnx' subfolder in the repo
    api.upload_folder(
        folder_path=onnx_output_dir,
        repo_id=repo_id,
        path_in_repo="onnx",
        commit_message="Add ONNX version of the distilled model"
    )
    print("\n✅ Successfully uploaded ONNX model to Hugging Face!")
    print(f"Check it here: https://huggingface.co/{repo_id}/tree/main/onnx")
except Exception as e:
    print(f"\n❌ Upload failed: {e}")
