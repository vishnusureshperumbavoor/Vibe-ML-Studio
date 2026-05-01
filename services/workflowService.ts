/**
 * Workflow Service
 * Handles the generation of complex Python scripts for various ML tasks.
 */

export const generateOnnxExportScript = (adapterSlug: string, precision: string): string => {
  return `import os
import json
import torch
import shutil
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
def run_onnx_production():
    adapter_slug = "${adapterSlug}"
    precision = "${precision}"
    adapters_root = r"d:\\Projects\\VML-Studio-Upgraded\\server\\models\\adapters"
    base_models_root = r"d:\\Projects\\VML-Studio-Upgraded\\server\\models\\base_models"
    export_root = r"d:\\Projects\\VML-Studio-Upgraded\\server\\models\\onnx_export"
    adapter_path = os.path.join(adapters_root, adapter_slug)
    config_path = os.path.join(adapter_path, "adapter_config.json")
    temp_merged_dir = os.path.join(export_root, f"temp_merged_{adapter_slug}")
    onnx_raw_dir = os.path.join(export_root, f"onnx_{adapter_slug}_fp32_export")
    onnx_final_dir = os.path.join(export_root, f"onnx_{adapter_slug}_{precision.lower()}_final")
    os.makedirs(temp_merged_dir, exist_ok=True)
    os.makedirs(onnx_raw_dir, exist_ok=True)
    
    skip_phase_1 = os.path.exists(os.path.join(temp_merged_dir, "config.json"))
    # Skip Phase 2 ONLY if the directory exists AND it actually contains a model file
    has_raw_model = any(f.endswith(".onnx") for f in os.listdir(onnx_raw_dir)) if os.path.exists(onnx_raw_dir) else False
    skip_phase_2 = has_raw_model and precision != "FP16"
    if skip_phase_1:
        print(f"⏩ Found existing merged weights at {temp_merged_dir}. Skipping Phase 1.")
    if skip_phase_2:
        print(f"⏩ Found existing raw export at {onnx_raw_dir}. Skipping Phase 2.")
    print(f"🚀 Starting ONNX Production for: {adapter_slug} ({precision})")
    try:
        if not skip_phase_1:
            with open(config_path, 'r') as f:
                config = json.load(f)
                base_model_name = config.get("base_model_name_or_path")
            print(f"📦 Base model requirement: {base_model_name}")
            base_model_folder = base_model_name.replace("/", "_")
            base_model_path = os.path.join(base_models_root, base_model_folder)
            if not os.path.exists(base_model_path):
                raise Exception(f"Local base model not found at: {base_model_path}")
            print("--- Phase 1: Merging Weights ---")
            base_model = AutoModelForCausalLM.from_pretrained(base_model_path, torch_dtype=torch.float32, trust_remote_code=True)
            model = PeftModel.from_pretrained(base_model, adapter_path)
            merged_model = model.merge_and_unload()
            merged_model.save_pretrained(temp_merged_dir, safe_serialization=False)
            tokenizer = AutoTokenizer.from_pretrained(base_model_path, trust_remote_code=True)
            tokenizer.save_pretrained(temp_merged_dir)
            print("✅ Merging complete.")
        if not skip_phase_2:
            print(f"--- Phase 2: Exporting to ONNX ---")
            export_args = ""
            target_export_dir = onnx_raw_dir
            if precision == "FP16":
                export_args = "--dtype fp16" 
                target_export_dir = onnx_final_dir
            cmd_export = f'optimum-cli export onnx --model {temp_merged_dir} --task text-generation-with-past {export_args} {target_export_dir}'
            print(f"Executing Export: {cmd_export}")
            # Run and capture output to extract validation data for the chart
            import subprocess
            process = subprocess.Popen(cmd_export, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in process.stdout:
                print(line, end='')
                if "max diff =" in line:
                    try:
                        # Extract layer number and diff value
                        # Example: - present.0.value: max diff = 0.0001
                        parts = line.split("present.")[1].split(".")
                        layer_idx = int(parts[0])
                        diff_val = float(line.split("max diff =")[1].strip().replace('.','',1).replace('.','')) # simple float extraction
                        # Better regex-free extraction
                        val_str = "".join(c for c in line.split("max diff =")[1] if c.isdigit() or c == '.')
                        print(f"[VML_PLOT] {{\\"layer\\": {layer_idx}, \\"max_diff\\": {val_str}}}")
                    except: pass
            ret = process.wait()
            if ret != 0:
                raise Exception(f"Export failed with exit code {ret}")
        final_path = onnx_raw_dir
        if precision == "INT8":
            print(f"--- Phase 3: Quantizing to INT8 ---")
            cmd_quant = f'optimum-cli onnxruntime quantize --onnx_model {onnx_raw_dir} -o {onnx_final_dir} --arm64' 
            print(f"Executing Quantization: {cmd_quant}")
            ret = os.system(cmd_quant)
            if ret != 0:
                raise Exception(f"Quantization failed with exit code {ret}")
            final_path = onnx_final_dir
        else:
            # If a broken final directory exists, remove it so we can move the fresh one in
            if os.path.exists(onnx_final_dir):
                is_broken = not any(f.endswith(".onnx") for f in os.listdir(onnx_final_dir))
                if is_broken:
                    print(f" Removing broken final directory: {onnx_final_dir}")
                    shutil.rmtree(onnx_final_dir)
            
            if os.path.exists(onnx_raw_dir) and not os.path.exists(onnx_final_dir):
                print(f"Moving {onnx_raw_dir} to {onnx_final_dir}")
                shutil.move(onnx_raw_dir, onnx_final_dir)
                final_path = onnx_final_dir
            elif os.path.exists(onnx_final_dir):
                final_path = onnx_final_dir
        model_found = False
        if final_path and os.path.exists(final_path):
            for f in os.listdir(final_path):
                if f.endswith(".onnx"):
                    model_found = True
                    break
        if not model_found:
            raise Exception(f"CRITICAL ERROR: No .onnx file found in {final_path}")
        print(f"🎉 MISSION ACCOMPLISHED! ONNX model ready at: {final_path}")
    except Exception as e:
        print(f"❌ Error during production: {e}")
        import traceback
        traceback.print_exc()

# Blank line below is mandatory for Python REPL to close the 'def' block
run_onnx_production()
`;
};
