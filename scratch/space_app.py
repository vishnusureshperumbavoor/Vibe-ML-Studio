
import gradio as gr
# Version: 1.1
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

model_id = "Qwen/Qwen2-0.5B"
adapter_id = "vishnusureshperumbavoor/qwen2-0-5b-trenser-distilled-vml"

print("Loading model and adapter...")
tokenizer = AutoTokenizer.from_pretrained(model_id)
base_model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=torch.float32, device_map="cpu")
model = PeftModel.from_pretrained(base_model, adapter_id)
print("Model ready!")

def chat(message, history):
    # Format prompt for Qwen
    prompt = f"<|im_start|>user\n{message}<|im_end|>\n<|im_start|>assistant\n"
    inputs = tokenizer(prompt, return_tensors="pt")
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs, 
            max_new_tokens=512, 
            temperature=0.7, 
            top_p=0.9,
            eos_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(outputs[0][len(inputs["input_ids"][0]):], skip_special_tokens=True)
    return response

demo = gr.ChatInterface(
    fn=chat,
    title="Trenser AI Assistant",
    description="Fine-tuned Qwen2-0.5B model for Trenser Technology Solutions.",
    examples=["What industries does Trenser operate in?", "What is the SPARK community?"]
)

if __name__ == "__main__":
    demo.launch()
