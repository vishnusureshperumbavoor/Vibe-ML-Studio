import os
import torch
from optimum.intel import OVStableDiffusionPipeline, OVStableDiffusionImg2ImgPipeline
from diffusers import LCMScheduler
from PIL import Image
import time

class ImageGenerationService:
    def __init__(self, models_dir="models/openvino"):
        self.models_dir = models_dir
        self.current_model_id = None
        self.pipeline = None
        self.device = "GPU" # Default to Intel Iris Xe
        
        # Ensure directory exists
        if not os.path.exists(self.models_dir):
            os.makedirs(self.models_dir, exist_ok=True)

    def _load_model(self, model_id, is_img2img=False):
        """Loads or switches the model in memory."""
        if self.current_model_id == model_id and self.pipeline is not None:
            # Check if we need to switch from txt2img to img2img
            if is_img2img and not isinstance(self.pipeline, OVStableDiffusionImg2ImgPipeline):
                pass # Need to reload
            elif not is_img2img and not isinstance(self.pipeline, OVStableDiffusionPipeline):
                pass # Need to reload
            else:
                return # Already loaded
        
        print(f"🔄 Switching model to: {model_id} (Img2Img: {is_img2img})")
        start_time = time.time()
        
        pipe_class = OVStableDiffusionImg2ImgPipeline if is_img2img else OVStableDiffusionPipeline
        
        # Determine local model path
        model_name = model_id.split("/")[-1]
        type_suffix = "img2img" if is_img2img else "txt2img"
        local_model_path = os.path.join(self.models_dir, f"{model_name}_{type_suffix}")
        
        # Load the model
        if not os.path.exists(local_model_path):
            print(f"🔄 Exporting {model_id} to local storage: {local_model_path}")
            self.pipeline = pipe_class.from_pretrained(
                model_id,
                export=True,
                device=self.device,
                compile=True,
                safety_checker=None
            )
            # Save for future use to save disk/time
            self.pipeline.save_pretrained(local_model_path)
            print(f"✅ Model exported to {local_model_path}")
        else:
            print(f"🚀 Loading optimized model from: {local_model_path}")
            self.pipeline = pipe_class.from_pretrained(
                local_model_path,
                device=self.device,
                compile=True,
                safety_checker=None
            )
        
        # Explicitly disable the safety checker to allow artistic content
        def dummy(images, **kwargs):
            return images, [False] * len(images)
        self.pipeline.safety_checker = dummy
        
        # Apply LCM scheduler if it's an LCM model for 4-step generation
        if "lcm" in model_id.lower():
            print("🚀 Applying LCM Scheduler for fast generation...")
            self.pipeline.scheduler = LCMScheduler.from_config(self.pipeline.scheduler.config)
            
        self.current_model_id = model_id
        print(f"✅ Model ready in {time.time() - start_time:.2f}s")

    def generate(self, prompt, model_id="runwayml/stable-diffusion-v1-5", steps=20, guidance=7.5):
        """Standard Text-to-Image generation."""
        self._load_model(model_id, is_img2img=False)
        
        print(f"🎨 Generating: {prompt}")
        result = self.pipeline(
            prompt=prompt, 
            num_inference_steps=steps, 
            guidance_scale=guidance
        ).images[0]
        
        return result

    def img2img(self, prompt, init_image, strength=0.6, model_id="runwayml/stable-diffusion-v1-5", steps=20):
        """Image-to-Image generation."""
        self._load_model(model_id, is_img2img=True)
        
        if isinstance(init_image, str):
            init_image = Image.open(init_image).convert("RGB")
            
        print(f"🎨 Refining image with prompt: {prompt}")
        result = self.pipeline(
            prompt=prompt,
            image=init_image,
            strength=strength,
            num_inference_steps=steps
        ).images[0]
        
        return result

# Singleton instance for the app
image_service = ImageGenerationService()
