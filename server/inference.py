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

    def _resolve_model_path(self, model_filename: str) -> str:
        if not model_filename:
            model_filename = "qwen2-0_5b-instruct-q4_k_m.gguf"

        model_path = os.path.join(self.models_dir, model_filename)
        if os.path.exists(model_path):
            return model_path

        # Fallback: check if any available .gguf file exists in models directory
        if os.path.exists(self.models_dir):
            candidates = [f for f in os.listdir(self.models_dir) if f.endswith(".gguf")]
            if candidates:
                if "qwen" in model_filename.lower():
                    qwen_cands = [c for c in candidates if "qwen" in c.lower()]
                    if qwen_cands:
                        return os.path.join(self.models_dir, qwen_cands[0])
                return os.path.join(self.models_dir, candidates[0])

        raise FileNotFoundError(f"Base GGUF model not found at {model_path}")

    def _resolve_lora_path(self, lora_path: str) -> str:
        if not lora_path:
            return None
        if os.path.isdir(lora_path):
            adapter_gguf = os.path.join(lora_path, "adapter.gguf")
            if os.path.exists(adapter_gguf):
                return adapter_gguf
            # Auto-convert if converter exists
            converter_script = os.path.join(lora_path, "vml_converter_engine.py")
            if os.path.exists(converter_script):
                try:
                    import subprocess, sys
                    print(f"Auto-converting LoRA adapter in {lora_path}...")
                    subprocess.run([sys.executable, converter_script, lora_path, adapter_gguf], check=True)
                    if os.path.exists(adapter_gguf):
                        return adapter_gguf
                except Exception as e:
                    print(f"Failed auto-converting LoRA: {e}")
            raise FileNotFoundError(f"GGUF LoRA adapter not found at {adapter_gguf}")
        return lora_path

    def load_model(self, model_filename: str, lora_path: str = None):
        if Llama is None:
            raise ImportError("llama-cpp-python not installed yet.")

        model_path = self._resolve_model_path(model_filename)
        resolved_lora = self._resolve_lora_path(lora_path)

        cache_key = (model_path, resolved_lora)

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
            lora_path=resolved_lora,
            n_ctx=4096,
            n_threads=os.cpu_count() or 4,
            n_gpu_layers=0,
            verbose=False
        )
        
        self.models_cache[cache_key] = model_instance
        self.locks[cache_key] = threading.Lock()
        return model_instance

    def chat_stream(self, model_filename: str, lora_path: str, messages: List[Dict]):
        model_path = self._resolve_model_path(model_filename)
        resolved_lora = self._resolve_lora_path(lora_path)
        
        cache_key = (model_path, resolved_lora)
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
                        "ttft": round(ttft) if ttft else 0,
                        "tps": round(tps, 2)
                    }

    def chat(self, model_filename: str, lora_path: str, messages: List[Dict]) -> str:
        """Synchronous chat method for benchmarking and programmatic access."""
        output = ""
        for chunk in self.chat_stream(model_filename, lora_path, messages):
            output += chunk.get("content", "")
        return output

# Singleton instance
base_dir = os.path.dirname(os.path.abspath(__file__))
native_manager = NativeInferenceManager(os.path.join(base_dir, "models", "gguf"))
