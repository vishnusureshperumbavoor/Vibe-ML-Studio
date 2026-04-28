# Model Quantization Skills

**Description:** Technical reference for GGUF and EXL2 model optimization.

## Core Utilities
- **llama.cpp Conversion:** Reference scripts for converting `safetensors` to `gguf`.
- **Quantization Types:** Guidelines for Q4_K_M, Q5_K_M, and Q8_0 bit-depths.
- **VML Fixers:** Logic for repairing architecture metadata in broken GGUF files.

## VML-Native Implementation
The `server/native_inference.py` handles the loading and execution of these quantized models using the llama.cpp engine.
