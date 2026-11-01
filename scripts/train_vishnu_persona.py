#!/usr/bin/env python3
"""
Vishnu Persona Fine-Tuning, GGUF Quantization & Hugging Face Publisher
====================================================================
End-to-end training script designed to run on high-performance cloud GPUs
(such as JarvisLabs A30 / A100).

Key Design Points:
1. Zero-System-Prompt Training: Matches V-S-P in-browser bot requirements.
   The model learns to speak naturally as Vishnu out-of-the-box without
   requiring a custom system instruction.
2. Response-Only Loss Masking: Computes gradient updates strictly on assistant (Vishnu) turns.
3. LoRA Adaptation: Rank 16, Alpha 32 targeting all linear projection layers.
4. Model Fusion: Fuses low-rank adapter directly into Qwen weights.
5. GGUF Export: Converts and quantizes to Q4_K_M (~380 MB) using llama.cpp.
6. Hugging Face Hub: Automatically pushes merged weights and GGUF artifact.
"""

import argparse
import os
import shutil
import subprocess
import sys
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    DataCollatorForSeq2Seq,
)
from peft import LoraConfig, get_peft_model
from huggingface_hub import HfApi, login

ZERO_SYSTEM_CHAT_TEMPLATE = (
    "{% for message in messages %}"
    "{{'<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n'}}"
    "{% endfor %}"
    "{% if add_generation_prompt %}"
    "{{'<|im_start|>assistant\n'}}"
    "{% endif %}"
)


def build_llama_cpp(repo_dir: str = "/tmp/llama.cpp"):
    """Clones and compiles llama.cpp for GGUF conversion and quantization."""
    print(f"🛠️ Setting up llama.cpp at {repo_dir}...")
    if not os.path.exists(repo_dir):
        subprocess.run(["git", "clone", "--depth", "1", "https://github.com/ggerganov/llama.cpp.git", repo_dir], check=True)
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "gguf"], check=True)
    if os.path.exists(f"{repo_dir}/requirements.txt"):
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", f"{repo_dir}/requirements.txt"], check=True)

    build_dir = os.path.join(repo_dir, "build")
    os.makedirs(build_dir, exist_ok=True)
    subprocess.run(["cmake", "-B", build_dir, repo_dir], check=True)
    subprocess.run(["cmake", "--build", build_dir, "--config", "Release", "-j4", "--target", "llama-quantize"], check=True)
    return repo_dir


def create_model_card(output_dir: str, repo_id: str, base_model: str):
    """Generates an informative Hugging Face model card README.md."""
    readme_content = f"""---
license: apache-2.0
base_model: {base_model}
tags:
- qwen
- persona
- vsp
- conversational
- lora
- gguf
- in-browser
pipeline_tag: text-generation
---

# {repo_id.split('/')[-1]}

Autonomous persona language model fine-tuned to converse authentically as **Vishnu Suresh Perumbavoor**.

Trained natively **without system prompts** using ChatML syntax (`<|im_start|>user ... <|im_end|><|im_start|>assistant ... <|im_end|>`) so that it automatically adopts Vishnu's natural conversational style, vocabulary, technical pacing, and tone without requiring custom prompt engineering.

## 🚀 Model Specifications
- **Base Architecture**: [`{base_model}`](https://huggingface.co/{base_model})
- **Parameters**: ~494M (0.5B)
- **Fine-Tuning Method**: PEFT / LoRA ($r=16, \\alpha=32$, all linear projection layers) merged into full weights.
- **In-Browser Compatibility**: Includes `q4_k_m` GGUF (~380 MB) optimized for `@wllama/wllama`, WebAssembly, WebGPU, and llama.cpp.

## 💻 Python Quickstart (Transformers)

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "{repo_id}"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.float16,
    device_map="auto"
)

# Zero system prompt required
prompt = "<|im_start|>user\\nWhat projects are you working on right now?<|im_end|>\\n<|im_start|>assistant\\n"
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

outputs = model.generate(
    **inputs,
    max_new_tokens=128,
    temperature=0.3,
    top_p=0.9,
    do_sample=True,
    stop_strings=["<|im_end|>"],
    tokenizer=tokenizer
)
print(tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True))
```

## 🌐 In-Browser WebAssembly / GGUF Usage (`@wllama/wllama`)
This model contains `vsp-persona-qwen2.5-0.5b-q4_k_m.gguf` ready to drop directly into in-browser assistants (such as the [V-S-P](https://github.com/vishnusureshperumbavoor/V-S-P) portfolio bot).
"""
    with open(os.path.join(output_dir, "README.md"), "w", encoding="utf-8") as f:
        f.write(readme_content)


def main():
    parser = argparse.ArgumentParser(description="Fine-tune Qwen 0.5B on Vishnu chat persona and export to GGUF.")
    parser.add_argument("--data-path", type=str, default="train_vishnu_persona.jsonl", help="Path to jsonl dataset.")
    parser.add_argument("--base-model", type=str, default="Qwen/Qwen2.5-0.5B-Instruct", help="Base model identifier.")
    parser.add_argument("--output-dir", type=str, default="./vsp_persona_output", help="Output directory for checkpoints.")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs.")
    parser.add_argument("--batch-size", type=int, default=4, help="Per device batch size.")
    parser.add_argument("--grad-accum", type=int, default=2, help="Gradient accumulation steps.")
    parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate.")
    parser.add_argument("--max-seq-len", type=int, default=1024, help="Max sequence length.")
    parser.add_argument("--repo-id", type=str, default="vishnusureshperumbavoor/vsp-persona-qwen-0.5b", help="Hugging Face repo ID.")
    parser.add_argument("--hf-token", type=str, default="", help="Hugging Face write token.")
    args = parser.parse_args()

    token = args.hf_token or os.environ.get("HF_TOKEN", "")
    if not token:
        raise ValueError("HF_TOKEN is required to push model to Hugging Face. Set --hf-token or HF_TOKEN env var.")

    login(token=token)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n🚀 Starting Vishnu Persona Fine-Tuning on device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")

    # 1. Load Tokenizer
    print(f"📖 Loading tokenizer for '{args.base_model}'...")
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    tokenizer.chat_template = ZERO_SYSTEM_CHAT_TEMPLATE
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # 2. Tokenize Dataset with Assistant-Only Response Masking
    print(f"📂 Loading and processing dataset from '{args.data_path}'...")
    raw_dataset = load_dataset("json", data_files=args.data_path, split="train")
    print(f"   - Loaded {len(raw_dataset)} dialogue samples.")

    def preprocess_conversation(example):
        input_ids = []
        labels = []
        for msg in example["messages"]:
            header = f"<|im_start|>{msg['role']}\n"
            body = f"{msg['content']}<|im_end|>\n"
            h_ids = tokenizer.encode(header, add_special_tokens=False)
            b_ids = tokenizer.encode(body, add_special_tokens=False)
            
            input_ids.extend(h_ids + b_ids)
            if msg["role"] == "assistant":
                labels.extend([-100] * len(h_ids))
                labels.extend(b_ids)
            else:
                labels.extend([-100] * (len(h_ids) + len(b_ids)))

        input_ids = input_ids[:args.max_seq_len]
        labels = labels[:args.max_seq_len]
        attention_mask = [1] * len(input_ids)

        return {
            "input_ids": input_ids,
            "labels": labels,
            "attention_mask": attention_mask,
        }

    tokenized_dataset = raw_dataset.map(preprocess_conversation, remove_columns=raw_dataset.column_names)

    # 3. Load Base Model
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    print(f"🧠 Loading base model '{args.base_model}' in {dtype}...")
    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        dtype=dtype,
        device_map="auto",
        trust_remote_code=True,
    )

    # 4. LoRA Configuration
    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 5. Collator and Trainer Setup
    collator = DataCollatorForSeq2Seq(
        tokenizer=tokenizer,
        model=model,
        padding=True,
        pad_to_multiple_of=8,
    )

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        warmup_steps=10,
        lr_scheduler_type="cosine",
        fp16=(dtype == torch.float16),
        bf16=(dtype == torch.bfloat16),
        logging_steps=10,
        save_strategy="no",
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        train_dataset=tokenized_dataset,
        data_collator=collator,
        args=training_args,
    )

    print("\n⚡ Beginning Supervised Fine-Tuning on Vishnu Persona...")
    trainer.train()
    print("✅ Training complete!")

    # 6. Merge LoRA Weights into Base Weights
    print("🧬 Merging LoRA adapter into base model weights...")
    merged_model = model.merge_and_unload()
    merged_dir = os.path.join(args.output_dir, "merged")
    os.makedirs(merged_dir, exist_ok=True)
    merged_model.save_pretrained(merged_dir, safe_serialization=True)
    tokenizer.save_pretrained(merged_dir)

    # 7. GGUF Quantization via llama.cpp
    llama_dir = build_llama_cpp()
    f16_gguf = os.path.join(merged_dir, "vsp-persona-qwen2.5-0.5b-f16.gguf")
    q4_gguf = os.path.join(merged_dir, "vsp-persona-qwen2.5-0.5b-q4_k_m.gguf")

    print("🔄 Converting merged model to F16 GGUF...")
    subprocess.run([
        sys.executable,
        f"{llama_dir}/convert_hf_to_gguf.py",
        merged_dir,
        "--outfile", f16_gguf,
        "--outtype", "f16",
    ], check=True)

    print("📉 Quantizing to Q4_K_M GGUF...")
    quant_bin = f"{llama_dir}/build/bin/llama-quantize"
    if not os.path.exists(quant_bin):
        for root, dirs, files in os.walk(os.path.join(llama_dir, "build")):
            if "llama-quantize" in files:
                candidate = os.path.join(root, "llama-quantize")
                if os.access(candidate, os.X_OK):
                    quant_bin = candidate
                    break
    subprocess.run([quant_bin, f16_gguf, q4_gguf, "q4_k_m"], check=True)

    if os.path.exists(f16_gguf):
        os.remove(f16_gguf)
    print(f"✅ Created quantized GGUF ({os.path.getsize(q4_gguf) / (1024*1024):.1f} MB): {q4_gguf}")

    # 8. Create Model Card
    create_model_card(merged_dir, args.repo_id, args.base_model)

    # 9. Push to Hugging Face Hub
    print(f"\n🚀 Pushing model and GGUF to Hugging Face Hub: '{args.repo_id}'...")
    api = HfApi(token=token)
    api.create_repo(repo_id=args.repo_id, exist_ok=True)
    api.upload_folder(
        folder_path=merged_dir,
        repo_id=args.repo_id,
        commit_message="feat: publish fine-tuned Vishnu persona model with merged weights and Q4_K_M GGUF",
    )
    print(f"🎉 SUCCESS! Model successfully published to: https://huggingface.co/{args.repo_id}")


if __name__ == "__main__":
    main()
