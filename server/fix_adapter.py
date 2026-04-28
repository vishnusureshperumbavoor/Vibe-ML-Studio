
import os
import json
import torch
import gguf
import sys
from safetensors.torch import load_file

def convert_fixed(adapter_path, output_path, arch="qwen2"):
    print(f"VML Native Engine: Starting FIXED conversion (Arch: {arch})...")
    
    config_path = os.path.join(adapter_path, "adapter_config.json")
    if not os.path.exists(config_path):
        print(f"Error: adapter_config.json not found in {adapter_path}")
        return

    with open(config_path, "r") as f: 
        cfg = json.load(f)
    
    w_path = os.path.join(adapter_path, "adapter_model.safetensors")
    if os.path.exists(w_path):
        weights = load_file(w_path)
    else:
        bin_path = os.path.join(adapter_path, "adapter_model.bin")
        if os.path.exists(bin_path):
            weights = torch.load(bin_path, map_location="cpu")
        else:
            print(f"Error: No weights found in {adapter_path}")
            return

    writer = gguf.GGUFWriter(output_path, arch)
    writer.add_string("general.type", "adapter")
    writer.add_string("adapter.type", "lora")
    writer.add_float32("adapter.lora.alpha", float(cfg.get("lora_alpha", 16.0)))
    
    vml_map = {
        "q_proj": "attn_q", 
        "k_proj": "attn_k", 
        "v_proj": "attn_v", 
        "o_proj": "attn_output", 
        "gate_proj": "ffn_gate", 
        "up_proj": "ffn_up", 
        "down_proj": "ffn_down"
    }
    
    tensor_count = 0
    for k, v in weights.items():
        if "lora_" not in k: continue
        parts = k.split(".")
        if "layers" not in parts: continue
        
        layer_idx = parts[parts.index("layers") + 1]
        target = parts[parts.index("layers") + 3]
        lora_part = "lora_a" if "lora_A" in k else "lora_b"
        
        gguf_name = f"blk.{layer_idx}.{vml_map.get(target, target)}.weight.{lora_part}"
        writer.add_tensor(gguf_name, v.numpy())
        tensor_count += 1
        
    writer.write_header_to_file()
    writer.write_kv_data_to_file()
    writer.write_tensors_to_file()
    writer.close()
    print(f"DONE: GGUF Adapter repaired and saved to {output_path} ({tensor_count} tensors converted).")

if __name__ == "__main__":
    # Path to the broken adapter directory
    adapter_dir = r"d:\Projects\VML-Studio\server\models\adapters\qwen2-0-5b-trenser_distilled_1776793858-jsonl-instruct-vml1"
    output_gguf = os.path.join(adapter_dir, "adapter.gguf")
    
    # Run the fix
    convert_fixed(adapter_dir, output_gguf, arch="qwen2")
