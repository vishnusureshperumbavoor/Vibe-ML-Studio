/**
 * Workflow Service
 * Handles the generation of complex Python scripts for various ML tasks.
 */

export const generateOnnxExportScript = (adapterSlug: string, precision: string): string => {
  return `import os
import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
def run_onnx_production():
    # Configuration
    adapter_slug = "${adapterSlug}"
    precision = "${precision}"
    adapters_root = r"d:\\Projects\\VML-Studio-Upgraded\\server\\models\\adapters"
    base_models_root = r"d:\\Projects\\VML-Studio-Upgraded\\server\\models\\base_models"
    export_root = r"d:\\Projects\\VML-Studio-Upgraded\\server\\models\\onnx_export"
    adapter_path = os.path.join(adapters_root, adapter_slug)
    config_path = os.path.join(adapter_path, "adapter_config.json")
    temp_merged_dir = os.path.join(export_root, f"temp_merged_{adapter_slug}")
    onnx_output_dir = os.path.join(export_root, f"onnx_{adapter_slug}_{precision.lower()}")
    os.makedirs(temp_merged_dir, exist_ok=True)
    os.makedirs(onnx_output_dir, exist_ok=True)
    print(f"🚀 Starting ONNX Production for: {adapter_slug} ({precision})")
    # 1. Resolve Base Model
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
            base_model_name = config.get("base_model_name_or_path")
        print(f"📦 Base model requirement: {base_model_name}")
        # Heuristic to find local path
        base_model_folder = base_model_name.replace("/", "_")
        base_model_path = os.path.join(base_models_root, base_model_folder)
        if not os.path.exists(base_model_path):
            raise Exception(f"Local base model not found at: {base_model_path}")
        print(f"✅ Found local base model: {base_model_path}")
        # 2. Merge Weights
        print("--- Phase 1: Merging Weights ---")
        base_model = AutoModelForCausalLM.from_pretrained(base_model_path, dtype=torch.float32, trust_remote_code=True)
        model = PeftModel.from_pretrained(base_model, adapter_path)
        merged_model = model.merge_and_unload()
        merged_model.save_pretrained(temp_merged_dir, safe_serialization=False)
        tokenizer = AutoTokenizer.from_pretrained(base_model_path, trust_remote_code=True)
        tokenizer.save_pretrained(temp_merged_dir)
        print("✅ Merging complete. Temporary model saved.")
        # 3. ONNX Export
        print(f"--- Phase 2: Exporting to ONNX ---")
        export_flag = ""
        if precision == "FP16":
            export_flag = "--fp16"
        # 1. Run standard export
        cmd_export = f'optimum-cli export onnx --model {temp_merged_dir} {export_flag} --task text-generation-with-past {onnx_output_dir}'
        print(f"Executing Export: {cmd_export}")
        os.system(cmd_export)
        # 2. Run Quantization if requested
        final_path = onnx_output_dir
        if precision == "INT8":
            print(f"--- Phase 3: Quantizing to INT8 ---")
            quant_output = onnx_output_dir + "_int8"
            cmd_quant = f'optimum-cli onnxruntime quantize --onnx_model {onnx_output_dir} -o {quant_output} --arm64' 
            # Note: --arm64 or --avx512 depending on CPU, using a safe default or generic
            print(f"Executing Quantization: {cmd_quant}")
            os.system(cmd_quant)
            final_path = quant_output
            print(f"✅ Quantization complete. Result at: {final_path}")
        print(f"🎉 MISSION ACCOMPLISHED! ONNX model ready at: {final_path}")
    except Exception as e:
        print(f"❌ Error during production: {e}")
        import traceback
        traceback.print_exc()


run_onnx_production()
`;
};
