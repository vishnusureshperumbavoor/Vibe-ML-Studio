# SFT Training Standards

**Rule 1: Hardware Pre-check**
Always verify available VRAM or System RAM before initiating a training loop. If resources are insufficient, fallback to CPU-only or 4-bit/8-bit quantization loading.

**Rule 2: Learning Rate Safety**
Never exceed a learning rate of 5e-4 for LoRA adapters unless explicitly requested. High learning rates cause gradient instability in small models like Qwen2-0.5B.

**Rule 3: Checkpointing**
Always save a final model checkpoint and the `training_args.bin` for auditability.

**Rule 4: Architecture Matching**
Ensure the GGUF conversion architecture matches the base model (e.g., use 'qwen2' for Qwen models, 'llama' for Llama-3).
