import os
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
import subprocess
import time
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

class VMLQuantOptimizer:
    """
    Vibe-ML Quantization Helper.
    Supports bitsandbytes quantization and Ollama (GGUF) integration.
    """
    
    @staticmethod
    def get_system_ram():
        """Returns total system RAM in GB."""
        try:
            import psutil
            return psutil.virtual_memory().total / (1024**3)
        except:
            return 8.0 # Default fallback
            
    @staticmethod
    def check_ollama():
        """Checks if Ollama CLI is accessible."""
        try:
            subprocess.run(["ollama", "--version"], capture_output=True, check=True)
            return True
        except:
            return False

    @classmethod
    def benchmark_speed(cls, model_id_or_path, is_quantized=False):
        """Measures simple tokens-per-second on the CPU."""
        tokenizer = AutoTokenizer.from_pretrained(model_id_or_path)
        
        # Load model with specific config based on quantization status
        load_args = {"device_map": "cpu"}
        if is_quantized:
            load_args["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True)
            
        print(f"Loading {model_id_or_path} for benchmark (on CPU)...")
        model = AutoModelForCausalLM.from_pretrained(model_id_or_path, **load_args)
        
        prompt = "Explain the importance of model optimization in one sentence."
        inputs = tokenizer(prompt, return_tensors="pt").to("cpu")
        
        print("Warmup run...")
        with torch.no_grad():
            _ = model.generate(**inputs, max_new_tokens=5, pad_token_id=tokenizer.eos_token_id)
            
        print("Starting timed generation...")
        start_time = time.time()
        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=50, pad_token_id=tokenizer.eos_token_id)
        end_time = time.time()
        
        tokens_generated = len(outputs[0]) - len(inputs[0])
        tps = tokens_generated / (end_time - start_time)
        
        return {
            "tokens_per_second": round(tps, 2),
            "total_time": round(end_time - start_time, 2),
            "is_quantized": is_quantized,
            "model": model_id_or_path
        }

    @classmethod
    def convert_to_gguf(cls, model_path, output_path, out_type="f16"):
        """
        Converts a Hugging Face model to GGUF format using llama.cpp conversion scripts.
        """
        import os
        import sys
        import subprocess
        import urllib.request

        print(f"Starting GGUF conversion for {model_path}...")
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        # Define conversion script local path
        script_path = os.path.join(os.path.dirname(__file__), "convert_hf_to_gguf.py")
        
        # Fallback: Download convert_hf_to_gguf.py if missing
        if not os.path.exists(script_path):
            print("Downloading stable conversion script (858d4a7)...")
            url = "https://raw.githubusercontent.com/ggerganov/llama.cpp/858d4a7fb1b6d19a413f3ba5962003886561110f/convert-hf-to-gguf.py"
            try:
                urllib.request.urlretrieve(url, script_path)
            except Exception as e:
                return {"error": f"Failed to download conversion script: {e}"}

        # Run conversion
        try:
            # Create a memory-safe wrapper to bypass gguf version crashes
            wrapper_path = os.path.join(os.path.dirname(script_path), "safe_convert.py")
            with open(wrapper_path, "w", encoding="utf-8") as f:
                f.write(f"""import sys
import gguf
if not hasattr(gguf.MODEL_ARCH, 'GEMMA4'): gguf.MODEL_ARCH.GEMMA4 = 'gemma4'
if not hasattr(gguf.MODEL_ARCH, 'MISTRAL4'): gguf.MODEL_ARCH.MISTRAL4 = 'mistral4'
sys.path.append(r"{os.path.dirname(script_path)}")
import convert_hf_to_gguf
sys.argv = ['convert_hf_to_gguf.py', r'{model_path}', '--outfile', r'{output_path}', '--outtype', '{out_type}']
try:
    convert_hf_to_gguf.main()
except SystemExit as e:
    sys.exit(e.code)
""")
            cmd = [sys.executable, wrapper_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            # Clean up wrapper
            if os.path.exists(wrapper_path):
                os.remove(wrapper_path)
            
            if result.returncode != 0:
                # If dependencies are missing, try to install them on the fly
                if "ModuleNotFoundError" in result.stderr:
                    print("Installing conversion dependencies (gguf, sentencepiece)...")
                    subprocess.run([sys.executable, "-m", "pip", "install", "gguf", "sentencepiece", "numpy"])
                    # Retry
                    result = subprocess.run(cmd, capture_output=True, text=True)
                
            if result.returncode == 0:
                return {"success": True, "path": os.path.abspath(output_path)}
            else:
                return {"error": f"Conversion failed: {result.stderr}"}
                
        except Exception as e:
            return {"error": f"GGUF Conversion failed: {str(e)}"}

    @staticmethod
    def generate_modelfile(gguf_path, system_prompt="You are a Vibe-ML optimized assistant."):
      """Generates an Ollama Modelfile with an absolute path to the GGUF."""
      abs_gguf_path = os.path.abspath(gguf_path).replace("\\", "/") # Ollama prefers forward slashes
      content = f"""FROM {abs_gguf_path}
PARAMETER temperature 0.7
PARAMETER top_p 0.9
SYSTEM \"\"\"{system_prompt}\"\"\"
"""
      modelfile_path = "Modelfile.temp"
      with open(modelfile_path, "w") as f:
          f.write(content)
      return modelfile_path

    @classmethod
    def import_to_ollama(cls, model_name, gguf_path):
        """Imports a GGUF model into Ollama."""
        if not cls.check_ollama():
            return {"error": "Ollama CLI not found in PATH."}
            
        modelfile = cls.generate_modelfile(gguf_path)
        print(f"Importing {model_name} to Ollama...")
        
        try:
            subprocess.run(["ollama", "create", model_name, "-f", modelfile], check=True)
            return {"success": True, "model": model_name}
        except Exception as e:
            return {"error": str(e)}
        finally:
            if os.path.exists(modelfile):
                os.remove(modelfile)

# Example Usage:
# optimizer = VMLQuantOptimizer()
# print(f"Detected RAM: {optimizer.get_system_ram():.2f} GB")
# if optimizer.check_ollama():
#     print("Ollama is ready for auto-import.")
