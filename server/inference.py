import os
import gc
import threading
import time
from typing import List, Dict
try:
    from llama_cpp import Llama
except ImportError:
    # Fallback for during installation
    Llama = None

class NativeInferenceManager:
    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.models_cache: Dict[tuple, Llama] = {}
        self.locks: Dict[tuple, threading.Lock] = {}
        self.cache_limit = 2

    def load_model(self, model_filename: str, lora_path: str = None):
        if Llama is None:
            raise ImportError("llama-cpp-python not installed yet.")

        model_path = os.path.join(self.models_dir, model_filename)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Base GGUF model not found at {model_path}")

        # Ensure lora_path points to the gguf adapter file if it's a directory
        if lora_path and os.path.isdir(lora_path):
            lora_path = os.path.join(lora_path, "adapter.gguf")
            if not os.path.exists(lora_path):
                raise FileNotFoundError(f"GGUF LoRA adapter not found at {lora_path}.")

        cache_key = (model_path, lora_path)

        # Return from cache if exists
        if cache_key in self.models_cache:
            return self.models_cache[cache_key]

        # Manage cache limit (Evict oldest if needed)
        if len(self.models_cache) >= self.cache_limit:
            self.models_cache.clear()
            self.locks.clear()
            gc.collect()

        # Initialize Llama.cpp engine with expanded context for RAG
        model_instance = Llama(
            model_path=model_path,
            lora_path=lora_path,
            n_ctx=4096,
            n_threads=os.cpu_count() or 4,
            n_gpu_layers=0,
            verbose=False
        )
        
        self.models_cache[cache_key] = model_instance
        self.locks[cache_key] = threading.Lock()
        return model_instance

    def chat_stream(self, model_filename: str, lora_path: str, messages: List[Dict]):
        model_path = os.path.join(self.models_dir, model_filename)
        if lora_path and os.path.isdir(lora_path):
            lora_path = os.path.join(lora_path, "adapter.gguf")
        
        cache_key = (model_path, lora_path)
        model = self.models_cache.get(cache_key)
        lock = self.locks.get(cache_key)

        if not model or not lock:
            raise RuntimeError("Model not pre-loaded.")

        # Standard ChatML Template
        prompt = ""
        for msg in messages:
            role = msg['role']
            content = msg['content']
            prompt += f"<|im_start|>{role}\n{content}<|im_end|>\n"
        
        # Tail the prompt to force the assistant to start generating
        prompt += "<|im_start|>assistant\n"

        # Performance Tracking
        t_start = time.perf_counter()
        ttft = None
        t_first_token = None
        token_count = 0

        # Lock this specific model for thread-safe inference
        with lock:
            stream = model(
                prompt,
                max_tokens=1024,
                stop=["<|im_end|>", "<|endoftext|>"],
                stream=True
            )
            
            for chunk in stream:
                text = chunk['choices'][0]['text']
                if text:
                    token_count += 1
                    t_now = time.perf_counter()
                    
                    if ttft is None:
                        ttft = (t_now - t_start) * 1000 # ms
                        t_first_token = t_now
                    
                    # Calculate TPS since first token
                    tps = 0
                    if t_first_token and t_now > t_first_token:
                        tps = token_count / (t_now - t_first_token)
                    
                    yield {
                        "content": text,
                        "ttft": round(ttft, 2) if ttft else 0,
                        "tps": round(tps, 2)
                    }

# Singleton instance
base_dir = os.path.dirname(os.path.abspath(__file__))
native_manager = NativeInferenceManager(os.path.join(base_dir, "models", "gguf"))
