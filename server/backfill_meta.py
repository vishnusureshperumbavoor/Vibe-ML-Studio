import os
import json

# Calculate dataset_dir dynamically relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
dataset_dir = os.path.join(BASE_DIR, "data", "datasets")

# Get username dynamically from HF API
from huggingface_hub import HfApi
from dotenv import load_dotenv

# Try loading env from multiple locations
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv(os.path.join(os.path.dirname(BASE_DIR), ".env"))

token = os.getenv("HF_TOKEN")
if not token:
    print("Error: HF_TOKEN not found in .env")
    exit(1)

try:
    api = HfApi(token=token)
    username = api.whoami()['name']
    print(f"Detected HF User: {username}")
except Exception as e:
    print(f"HF Auth failed: {e}")
    exit(1)

if os.path.exists(dataset_dir):
    for f in os.listdir(dataset_dir):
        if f.endswith(".jsonl"):
            # Skip if already has meta
            if os.path.exists(os.path.join(dataset_dir, f + ".meta")):
                continue
                
            collection_name = f.split("_distilled_")[0]
            # Construct the standard repository name we use in dataset_uploader.py
            # repo_name = f"{collection_name}-vml-distilled"
            hf_url = f"https://huggingface.co/datasets/{username}/{collection_name}-vml-distilled"
            
            meta_path = os.path.join(dataset_dir, f + ".meta")
            with open(meta_path, 'w') as mf:
                json.dump({"hf_url": hf_url}, mf)
            print(f"Backfilled metadata for: {f} -> {hf_url}")
