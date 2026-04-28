import os
import json
import requests
import time
import asyncio
from typing import List, Dict, Any
from rag_service import knowledge_manager
from dataset_uploader import upload_dataset_to_hf

class VMLDistiller:
    """
    Automated Black Box Distillation Agent.
    Transforms raw knowledge collections into datasets and auto-deploys to HF.
    """
    def __init__(self):
        self.api_key = os.getenv("VITE_KIMI_API_KEY") or os.getenv("KIMI_API_KEY")
        self.api_url = "https://api.moonshot.ai/v1/chat/completions"
        self.status = {"step": "idle", "progress": 0, "current_task": ""}

    def update_status(self, step: str, progress: int, task: str):
        self.status = {"step": step, "progress": progress, "current_task": task}
        print(f"[{step.upper()}] {progress}% - {task}")

    def generate_alpaca_pairs(self, text_chunk: str, persona: str = "Standard Expert") -> List[Dict[str, str]]:
        """Calls Kimi API to generate instruction-response pairs from a chunk."""
        self.api_key = os.getenv("VITE_KIMI_API_KEY") or os.getenv("KIMI_API_KEY")
        if not self.api_key:
            raise ValueError("KIMI_API_KEY not found in environment.")

        if persona.lower() == "generic":
            role_description = "a highly accurate information extractor. Your goal is to extract neutral, factual instruction-response pairs that represent the core content of the document without any departmental bias."
        else:
            role_description = f"a {persona}. Your goal is to extract high-quality, diverse instruction-response pairs that represent the document through the specific lens and expertise of your role."

        prompt = f"""
        You are {role_description}
        Your goal is to extract high-quality, diverse instruction-response pairs for fine-tuning an AI model.
        
        Chunk:
        \"\"\"{text_chunk}\"\"\"
        
        RULES:
        1. Output ONLY a valid JSON list of objects.
        2. Each object must have: "instruction", "input" (can be empty), and "output".
        3. Ensure instructions are specific and the outputs are factually grounded in the chunk.
        4. Generate exactly 3-5 pairs depending on chunk density.
        """

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        payload = {
            "model": "moonshot-v1-8k",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "response_format": {"type": "json_object"}
        }

        try:
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=60)
            if response.status_code == 429:
                time.sleep(5) 
                return self.generate_alpaca_pairs(text_chunk)
            
            response.raise_for_status()
            data = response.json()
            content = data['choices'][0]['message']['content']
            
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                for key in ['pairs', 'data', 'instructions', 'dataset']:
                    if key in parsed and isinstance(parsed[key], list):
                        return parsed[key]
                return [parsed]
            return parsed
        except Exception as e:
            print(f"Error distilling chunk: {e}")
            return []

    async def distill_collection(self, collection_name: str, auto_deploy: bool = True, persona: str = "Standard Expert"):
        """Standard distillation pipeline: Fetch -> Distill -> Save -> [Auto-Deploy]."""
        try:
            self.api_key = os.getenv("VITE_KIMI_API_KEY") or os.getenv("KIMI_API_KEY")
            if not self.api_key:
                self.update_status("error", 0, "Missing KIMI_API_KEY. Add it to .env or Settings.")
                return None

            self.update_status("extracting", 10, f"Autonomous Agent reading: {collection_name}")
            
            # 1. Fetch chunks
            raw_data = knowledge_manager.explore_collection(collection_name, limit=200)
            if not raw_data:
                self.update_status("error", 0, "No data in collection to distill.")
                return None

            total_chunks = len(raw_data)
            self.update_status("distilling", 20, f"Mining {total_chunks} chunks with Kimi...")

            dataset = []
            for i, chunk in enumerate(raw_data):
                progress = 20 + int((i / total_chunks) * 50)
                self.update_status("distilling", progress, f"Synthesizing chunk {i+1}/{total_chunks} as {persona}")
                
                pairs = self.generate_alpaca_pairs(chunk['content'], persona=persona)
                dataset.extend(pairs)
                await asyncio.sleep(0.5)

            # 2. Save Dataset
            self.update_status("saving", 75, "Consolidating dataset into JSONL format...")
            base_dir = os.path.dirname(os.path.abspath(__file__))
            dataset_dir = os.path.join(base_dir, "data", "datasets")
            os.makedirs(dataset_dir, exist_ok=True)
            
            persona_slug = persona.lower().replace(" ", "_").replace("&", "n")
            filename = f"{collection_name}_{persona_slug}_{int(time.time())}.jsonl"
            filepath = os.path.join(dataset_dir, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                for item in dataset:
                    f.write(json.dumps(item) + '\n')

            # 3. Autonomous Handover (THE AGENTIC PART)
            if auto_deploy:
                self.update_status("deploying", 85, "Agent starting autonomous deployment...")
                await asyncio.sleep(1) # Visual pause for the user to see the transition
                
                self.update_status("deploying", 90, "Creating Hugging Face repository & README...")
                result = upload_dataset_to_hf(filepath, collection_name, collection_name)
                
                if "error" in result:
                    self.update_status("error", 0, f"Handover Failed: {result['error']}")
                else:
                    self.update_status("complete", 100, f"Mission Accomplished! Published to: {result['url']}")
                    # Save metadata for future UI retrieval
                    try:
                        meta_path = filepath + ".meta"
                        with open(meta_path, 'w') as mf:
                            json.dump({
                                "hf_url": result['url'],
                                "collection": collection_name,
                                "timestamp": time.time()
                            }, mf)
                    except:
                        pass
            else:
                self.update_status("complete", 100, f"Distillation complete. Dataset saved as {filename}")
                
            return filepath
        except Exception as e:
            self.update_status("error", 0, f"Agent System Error: {str(e)}")
            return None

distiller = VMLDistiller()
