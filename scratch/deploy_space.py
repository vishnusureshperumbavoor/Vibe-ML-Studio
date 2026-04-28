
import os
from huggingface_hub import HfApi, create_repo
from dotenv import load_dotenv

load_dotenv()
token = os.getenv("HF_TOKEN")

api = HfApi(token=token)
user_info = api.whoami()
username = user_info['name']

repo_id = f"{username}/trenser-ai-assistant"

print(f"Creating Space: {repo_id}...")
try:
    create_repo(
        repo_id=repo_id, 
        token=token, 
        repo_type="space", 
        space_sdk="gradio", 
        private=False, 
        exist_ok=True
    )
    
    # Upload files
    print("Uploading app.py...")
    api.upload_file(
        path_or_fileobj=r"d:\Projects\VML-Studio\scratch\space_app.py",
        path_in_repo="app.py",
        repo_id=repo_id,
        repo_type="space"
    )
    
    print("Uploading requirements.txt...")
    api.upload_file(
        path_or_fileobj=r"d:\Projects\VML-Studio\scratch\space_requirements.txt",
        path_in_repo="requirements.txt",
        repo_id=repo_id,
        repo_type="space"
    )
    
    print(f"Space successfully created at: https://huggingface.co/spaces/{repo_id}")
except Exception as e:
    print(f"Error: {e}")
