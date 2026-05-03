import time
import os
from optimum.intel import OVStableDiffusionPipeline

# This is a real, high-quality model (approx 4GB download)
MODEL_ID = "runwayml/stable-diffusion-v1-5"

def generate_cat():
    print("="*50)
    print("🐱 VML Studio - High Quality Image Test")
    print("="*50)
    
    # Target your Intel Iris Xe
    device = "GPU"
    
    try:
        print(f"📥 Loading Stable Diffusion 1.5 (This will download ~4GB on first run)...")
        start_time = time.time()
        
        # Load and optimize for OpenVINO (Safety Checker disabled to save RAM)
        pipe = OVStableDiffusionPipeline.from_pretrained(
            MODEL_ID, 
            export=True, 
            device=device,
            compile=True,
            safety_checker=None
        )
        
        load_time = time.time() - start_time
        print(f"✅ Model ready in {load_time:.2f} seconds.")
        
        # Inference settings for a good quality image
        prompt = "Portrait of a woman in a futuristic sci-fi setting, cinematic lighting, highly detailed, sharp focus, 8k"
        steps = 20 # 20 steps for good quality
        
        print(f"🎨 Generating high-quality image ({steps} steps)...")
        print("Note: This will take about 30-60 seconds on your Iris Xe.")
        
        gen_start = time.time()
        result = pipe(prompt, num_inference_steps=steps).images[0]
        gen_time = time.time() - gen_start
        
        # Save result
        output_path = os.path.join(os.path.dirname(__file__), "vml_generated_image.png")
        result.save(output_path)
        
        print(f"✨ Success! The cat is ready at: {output_path}")
        print(f"⏱️ Generation Time: {gen_time:.2f} seconds")
        print("="*50)

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    generate_cat()
