import os
import sys
import torch
from PIL import Image
import time
import threading
from huggingface_hub import snapshot_download

_IMAGE_BACKEND_IMPORT_ERROR = None

# Attempt to load Optimum-Intel OpenVINO pipelines
try:
    from optimum.intel import OVStableDiffusionPipeline, OVStableDiffusionImg2ImgPipeline
    from diffusers import LCMScheduler
except Exception as exc:
    OVStableDiffusionPipeline = None
    OVStableDiffusionImg2ImgPipeline = None
    LCMScheduler = None
    _IMAGE_BACKEND_IMPORT_ERROR = exc

# Load Diffusers pipelines as standard fallback
try:
    from diffusers import StableDiffusionPipeline, StableDiffusionImg2ImgPipeline
except Exception as diffusers_exc:
    StableDiffusionPipeline = None
    StableDiffusionImg2ImgPipeline = None

class ImageGenerationService:
    def __init__(self, models_dir="models/openvino"):
        self.models_dir = models_dir
        self.current_model_id = None
        self.pipeline = None
        self.backend_type = None # "openvino" or "diffusers"
        self.device = "GPU" if sys.platform != "darwin" else "CPU"
        
        # Download state tracking
        self.download_state = {
            "status": "idle", # "idle" | "downloading" | "ready" | "error"
            "model_id": "stable-diffusion-v1-5/stable-diffusion-v1-5",
            "message": "",
            "progress_percent": 0
        }
        self._lock = threading.Lock()
        
        # Ensure directory exists
        if not os.path.exists(self.models_dir):
            os.makedirs(self.models_dir, exist_ok=True)

    def is_model_downloaded(self, model_id="stable-diffusion-v1-5/stable-diffusion-v1-5"):
        """Checks whether the model exists locally in OpenVINO export or HuggingFace cache."""
        model_name = model_id.split("/")[-1]
        
        # 1. Check local openvino exported directories
        txt_path = os.path.join(self.models_dir, f"{model_name}_txt2img")
        img_path = os.path.join(self.models_dir, f"{model_name}_img2img")
        if os.path.exists(txt_path) and os.path.isdir(txt_path):
            return True

        # 2. Check HuggingFace hub cache
        cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
        hub_folder = f"models--{model_id.replace('/', '--')}"
        hf_cache_path = os.path.join(cache_dir, hub_folder)
        if os.path.exists(hf_cache_path) and os.path.isdir(hf_cache_path):
            snapshots_dir = os.path.join(hf_cache_path, "snapshots")
            if os.path.exists(snapshots_dir) and len(os.listdir(snapshots_dir)) > 0:
                return True
                
        # Also check runwayml mirror if checking stable-diffusion-v1-5
        if "stable-diffusion-v1-5" in model_id:
            mirror_folder = "models--runwayml--stable-diffusion-v1-5"
            mirror_path = os.path.join(cache_dir, mirror_folder, "snapshots")
            if os.path.exists(mirror_path) and len(os.listdir(mirror_path)) > 0:
                return True

        return False

    def get_status(self, model_id="stable-diffusion-v1-5/stable-diffusion-v1-5"):
        """Returns the current download & ready status of the model."""
        with self._lock:
            downloaded = self.is_model_downloaded(model_id)
            status = "ready" if downloaded else self.download_state.get("status", "idle")
            if self.download_state.get("status") == "downloading":
                status = "downloading"
            return {
                "model_id": model_id,
                "is_downloaded": downloaded,
                "status": status,
                "message": self.download_state.get("message", ""),
                "backend": "OpenVINO" if OVStableDiffusionPipeline is not None else "Diffusers PyTorch"
            }

    def start_background_download(self, model_id="stable-diffusion-v1-5/stable-diffusion-v1-5"):
        """Initiates an asynchronous background download of the model."""
        with self._lock:
            if self.download_state["status"] == "downloading":
                return {"status": "already_downloading", "message": "Download is already in progress."}
            
            self.download_state["status"] = "downloading"
            self.download_state["model_id"] = model_id
            self.download_state["message"] = f"Downloading {model_id} from Hugging Face..."

        thread = threading.Thread(target=self._download_worker, args=(model_id,), daemon=True)
        thread.start()
        return {"status": "started", "message": f"Download of {model_id} started in background."}

    def _download_worker(self, model_id):
        try:
            print(f"📥 Starting download of model {model_id}...")
            # Download model weights to HF cache
            snapshot_download(
                repo_id=model_id,
                ignore_patterns=["*.msgpack", "*.bin"] if False else None
            )
            
            # Pre-export or initialize pipeline if possible
            try:
                self._load_model(model_id, is_img2img=False)
            except Exception as load_err:
                print(f"⚠️ Pre-load note: {load_err}")

            with self._lock:
                self.download_state["status"] = "ready"
                self.download_state["message"] = f"{model_id} is downloaded and ready for inference."
            print(f"✅ Model {model_id} download and preparation completed!")
        except Exception as e:
            with self._lock:
                self.download_state["status"] = "error"
                self.download_state["message"] = f"Download failed: {str(e)}"
            print(f"❌ Error downloading model {model_id}: {e}")

    def _load_model(self, model_id, is_img2img=False):
        """Loads or switches the model in memory with OpenVINO or Diffusers fallback."""
        if self.current_model_id == model_id and self.pipeline is not None:
            if is_img2img and "Img2Img" in type(self.pipeline).__name__:
                return
            elif not is_img2img and "Img2Img" not in type(self.pipeline).__name__:
                return
        
        print(f"🔄 Switching model to: {model_id} (Img2Img: {is_img2img})")
        start_time = time.time()
        
        # Try OpenVINO first
        if OVStableDiffusionPipeline is not None:
            try:
                pipe_class = OVStableDiffusionImg2ImgPipeline if is_img2img else OVStableDiffusionPipeline
                model_name = model_id.split("/")[-1]
                type_suffix = "img2img" if is_img2img else "txt2img"
                local_model_path = os.path.join(self.models_dir, f"{model_name}_{type_suffix}")
                
                if not os.path.exists(local_model_path):
                    print(f"🔄 Exporting {model_id} to OpenVINO: {local_model_path}")
                    self.pipeline = pipe_class.from_pretrained(
                        model_id,
                        export=True,
                        device=self.device,
                        compile=True,
                        safety_checker=None
                    )
                    self.pipeline.save_pretrained(local_model_path)
                else:
                    print(f"🚀 Loading OpenVINO model from: {local_model_path}")
                    self.pipeline = pipe_class.from_pretrained(
                        local_model_path,
                        device=self.device,
                        compile=True,
                        safety_checker=None
                    )
                
                self.backend_type = "openvino"
                def dummy(images, **kwargs): return images, [False] * len(images)
                self.pipeline.safety_checker = dummy
                
                if "lcm" in model_id.lower() and LCMScheduler is not None:
                    self.pipeline.scheduler = LCMScheduler.from_config(self.pipeline.scheduler.config)
                    
                self.current_model_id = model_id
                print(f"✅ OpenVINO model ready in {time.time() - start_time:.2f}s")
                return
            except Exception as ov_err:
                print(f"⚠️ OpenVINO pipeline init failed ({ov_err}); falling back to Diffusers PyTorch.")

        # Fallback to Diffusers PyTorch
        if StableDiffusionPipeline is not None:
            pipe_class = StableDiffusionImg2ImgPipeline if is_img2img else StableDiffusionPipeline
            torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            device = "cuda" if torch.cuda.is_available() else "cpu"
            
            print(f"🚀 Loading Diffusers pipeline ({device}, {torch_dtype}) for {model_id}...")
            self.pipeline = pipe_class.from_pretrained(
                model_id,
                torch_dtype=torch_dtype,
                safety_checker=None
            )
            self.pipeline.to(device)
            self.backend_type = "diffusers"
            self.current_model_id = model_id
            print(f"✅ Diffusers PyTorch model ready in {time.time() - start_time:.2f}s")
            return

        raise RuntimeError("Neither OpenVINO nor Diffusers could load the model.")

    def generate(self, prompt, model_id="stable-diffusion-v1-5/stable-diffusion-v1-5", steps=20, guidance=7.5):
        """Standard Text-to-Image generation."""
        self._load_model(model_id, is_img2img=False)
        print(f"🎨 Generating ({self.backend_type}): {prompt}")
        result = self.pipeline(
            prompt=prompt, 
            num_inference_steps=steps, 
            guidance_scale=guidance
        ).images[0]
        return result

    def img2img(self, prompt, init_image, strength=0.6, model_id="stable-diffusion-v1-5/stable-diffusion-v1-5", steps=20):
        """Image-to-Image generation."""
        self._load_model(model_id, is_img2img=True)
        if isinstance(init_image, str):
            init_image = Image.open(init_image).convert("RGB")
        print(f"🎨 Refining image ({self.backend_type}): {prompt}")
        result = self.pipeline(
            prompt=prompt,
            image=init_image,
            strength=strength,
            num_inference_steps=steps
        ).images[0]
        return result

# Singleton instance for the app
image_service = ImageGenerationService()
