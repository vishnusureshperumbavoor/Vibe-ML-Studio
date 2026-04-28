import urllib.request
import os

URL = 'https://raw.githubusercontent.com/ggerganov/llama.cpp/master/convert_hf_to_gguf.py'
PATH = r'd:\Projects\VML-Studio\skills\model-quantization\references\convert_hf_to_gguf.py'

print(f"Downloading from {URL}...")
urllib.request.urlretrieve(URL, PATH)

print(f"Patching {PATH}...")
with open(PATH, 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open(PATH, 'w', encoding='utf-8') as f:
    for line in lines:
        if 'MODEL_ARCH.GEMMA4' in line:
            # We comment out the entire line or replace it with a harmless one
            f.write(line.replace('gguf.MODEL_ARCH.GEMMA4', '"gemma4_patched"'))
        elif 'Gemma4Model' in line:
             f.write(line.replace('Gemma4Model', 'Gemma4ModelPatched'))
        else:
            f.write(line)

print("Patching complete. Verifying file...")
if os.path.exists(PATH):
    print(f"Success! {PATH} is ready.")
else:
    print("Failure: File was not created.")
