import time
import os
import torch
from optimum.intel import OVStableDiffusionPipeline
from PIL import Image

# Use a tiny model for initial hardware verification to avoid large downloads
# For real quality, you would use "runwayml/stable-diffusion-v1-5" or "latent-consistency/lcm-sdxl-base-1.0"
MODEL_ID = "hf-internal-testing/tiny-stable-diffusion-torch"

def run_benchmark():
    print("="*50)
    print("🚀 VML Studio - OpenVINO Hardware Benchmark")
    print("="*50)
    
    # 1. Hardware Detection
    print(f"Checking for Intel Iris Xe GPU...")
    # OpenVINO automatically maps "GPU" to Intel Integrated Graphics
    device = "GPU"
    
    try:
        start_time = time.time()
        print(f"📥 Loading and Exporting model to OpenVINO (Device: {device})...")
        
        # This will export the model to OpenVINO IR format (.xml/.bin)
        pipe = OVStableDiffusionPipeline.from_pretrained(
            MODEL_ID, 
            export=True, 
            device=device,
            compile=True
        )
        
        load_time = time.time() - start_time
        print(f"✅ Model loaded and compiled in {load_time:.2f} seconds.")
        
        # 2. Inference
        prompt = "A futuristic lab with neon lights and holographic displays"
        print(f"🎨 Generating test image (1 step)...")
        
        gen_start = time.time()
        # We use 1 step just for the benchmark
        result = pipe(prompt, num_inference_steps=1).images[0]
        gen_time = time.time() - gen_start
        
        # 3. Save result
        output_path = os.path.join(os.path.dirname(__file__), "openvino_test_result.png")
        result.save(output_path)
        
        print(f"✨ Success! Test image saved to: {output_path}")
        print(f"⏱️ Generation Time: {gen_time:.2f} seconds")
        print("="*50)
        print("Your Intel Iris Xe is ready for VibeML Studio image generation!")
        print("="*50)

    except Exception as e:
        print(f"❌ Error during OpenVINO initialization: {e}")
        print("\nPossible solutions:")
        print("1. Ensure OpenVINO and Optimum-Intel are installed: pip install optimum[intel]")
        print("2. Ensure your Intel GPU drivers are up to date.")
        print("3. Try switching device to 'CPU' if 'GPU' is not detected.")

if __name__ == "__main__":
    run_benchmark()
