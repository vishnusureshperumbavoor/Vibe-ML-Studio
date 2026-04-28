# Quantization Standards

**Rule 1: Perplexity Validation**
Always compare the perplexity of the quantized model against the FP16 base. If the degradation exceeds 5%, a higher bit-depth is required.

**Rule 2: Hardware Target**
Select the quantization method based on the target hardware (GGUF for CPU/Mac, EXL2 for NVIDIA GPUs).

**Rule 3: Metadata Integrity**
Ensure all GGUF files contain correct architecture labels (e.g., 'qwen2') to prevent runtime access violations.
