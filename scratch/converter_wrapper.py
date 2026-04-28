
import gguf
if not hasattr(gguf.MODEL_ARCH, "GEMMA4"): gguf.MODEL_ARCH.GEMMA4 = "gemma4"
if not hasattr(gguf.MODEL_ARCH, "MISTRAL4"): gguf.MODEL_ARCH.MISTRAL4 = "mistral4"
import sys
sys.path.append(r"d:\Projects\VML-Studio\skills\model-quantization\references")
import convert_hf_to_gguf
sys.argv = ["convert_hf_to_gguf.py", r"d:\Projects\VML-Studio\server\data\qwen_snapshot", "--outfile", r"d:\Projects\VML-Studio\server\data\qwen2_05b.gguf", "--outtype", "f16"]
convert_hf_to_gguf.main()
