import time
import os
from optimum.intel import OVStableDiffusionPipeline

# This is a real, high-quality model (approx 4GB download)
MODEL_ID = "runwayml/stable-diffusion-v1-5"

def generate_cat():
    print("="*50)
    print("VML Studio - High Quality Image Test")
    print("="*50)
    
    # Target your Intel Iris Xe
    device = "GPU"
    
    print(f"Starting image generation process...")
    start_time = time.time()
    
    # Permanent local path for the exported model
    model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "openvino", "stable-diffusion-v1-5")
    
    try:
        if not os.path.exists(model_path):
            print(f"Loading and exporting Stable Diffusion 1.5 to: {model_path}")
            print("This is a ONE-TIME process and will take a few minutes...")
            pipe = OVStableDiffusionPipeline.from_pretrained(
                MODEL_ID, 
                export=True, 
                device=device,
                compile=True,
                safety_checker=None
            )
            # Save the exported model permanently
            pipe.save_pretrained(model_path)
            print(f"Model exported successfully to {model_path}")
        else:
            print(f"Loading optimized model from local storage: {model_path}")
            pipe = OVStableDiffusionPipeline.from_pretrained(
                model_path, 
                device=device,
                compile=True,
                safety_checker=None
            )
        
        # Explicitly disable the safety checker
        def dummy(images, **kwargs):
            return images, [False] * len(images)
        pipe.safety_checker = dummy
        
        load_time = time.time() - start_time
        print(f"Model ready in {load_time:.2f} seconds.")
        
        # Inference settings aligned with Creative Studio UI
        prompt = "a majestic lion in the savanna, sunset lighting, high detail, nature photography"
        steps = 20
        guidance_scale = 7.5
        
        print(f"Generating high-quality artistic image ({steps} steps)...")
        print("Note: This will take about 60-90 seconds on your Iris Xe due to higher resolution.")
        
        gen_start = time.time()
        result = pipe(
            prompt, 
            num_inference_steps=steps,
            guidance_scale=guidance_scale
        ).images[0]
        gen_time = time.time() - gen_start
        
        # Save result to the centralized generated data directory
        output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "generated")
        os.makedirs(output_dir, exist_ok=True)
        
        output_path = os.path.join(output_dir, "vml_test_image.png")
        result.save(output_path)
        
        print(f"Success! The image is ready at: {output_path}")
        print(f"Generation Time: {gen_time:.2f} seconds")
        print("="*50)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    generate_cat()
