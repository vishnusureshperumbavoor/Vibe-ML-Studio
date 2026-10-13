import json
from typing import List, Dict, Any, Optional

DEFAULT_DEMO_DATASET = [
    # Clinical Triage Sample Dataset (Emergency vs Urgent vs Routine)
    {"text": "Patient with sudden crushing chest pain radiating to left arm and cold sweats", "label": "emergency"},
    {"text": "Unresponsive elderly patient with suspected massive intracranial hemorrhage", "label": "emergency"},
    {"text": "Acute severe shortness of breath with SpO2 dropping below 82 percent", "label": "emergency"},
    {"text": "Severe persistent asthma exacerbation not responding to repeated albuterol inhalers", "label": "urgent"},
    {"text": "Deep laceration on forearm with controlled bleeding requiring sutures", "label": "urgent"},
    {"text": "High fever of 39.5C for three days with persistent cough and pleuritic pain", "label": "urgent"},
    {"text": "Mild seasonal allergic rhinitis with sneezing and clear nasal discharge for 1 week", "label": "routine"},
    {"text": "Routine prescription refill for blood pressure medication, asymptomatic", "label": "routine"},
    {"text": "Mild superficial abrasion on knee after minor fall, ambulatory and stable", "label": "routine"},
    {"text": "Annual preventive wellness exam request and routine blood panel review", "label": "routine"},
]

def generate_decision_training_script(
    model_id: str = "convaiinnovations/laya",
    labels: Optional[List[str]] = None,
    dataset: Optional[List[Dict[str, str]]] = None,
    epochs: int = 3,
    learning_rate: float = 3e-5,
    batch_size: int = 4,
    output_dir: str = "./laya_decision_model"
) -> str:
    """
    Generates a self-contained Python script to execute on Google Colab for
    fine-tuning a ModernBERT / Laya System 1 Decision Model.
    """
    if dataset is None or len(dataset) == 0:
        dataset = DEFAULT_DEMO_DATASET

    if labels is None or len(labels) == 0:
        labels = sorted(list(set(item["label"] for item in dataset)))

    id2label = {i: lbl for i, lbl in enumerate(labels)}
    label2id = {lbl: i for i, lbl in enumerate(labels)}

    data_json = json.dumps(dataset)
    labels_json = json.dumps(labels)
    id2label_json = json.dumps(id2label)
    label2id_json = json.dumps(label2id)

    script = f'''
import sys
import os
import json
import torch

print("🚀 [Colab GPU] Initializing VSP ML Decision Model Engine...")
print(f"📦 PyTorch Version: {{torch.__version__}} | Device: {{'cuda' if torch.cuda.is_available() else 'cpu'}}")
if torch.cuda.is_available():
    print(f"⚡ GPU: {{torch.cuda.get_device_name(0)}} ({{round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2)}} GB)")

# 1. Ensure required lightweight libraries are ready
try:
    import transformers
    import sentencepiece
    import tiktoken
except ImportError:
    print("Installing transformers, sentencepiece & tiktoken...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "transformers", "accelerate", "datasets", "sentencepiece", "tiktoken"], check=True)
    import transformers

from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
from datasets import Dataset

# 2. Setup labels and dataset
labels = {labels_json}
id2label = {id2label_json}
id2label = {{int(k): v for k, v in id2label.items()}}
label2id = {label2id_json}
raw_data = {data_json}

print(f"📊 Training Data: {{len(raw_data)}} samples across {{len(labels)}} classes: {{labels}}")

# Convert labels to integer targets
processed_data = [{{"text": d["text"], "label": label2id[d["label"]]}} for d in raw_data]

train_dataset = Dataset.from_list(processed_data)

# 3. Load Tokenizer & Model
model_id = "{model_id}"
fallback_model = "answerdotai/ModernBERT-base"

print(f"🧠 Loading base decision model: '{{model_id}}'...")
tokenizer = None
model = None

for target in [model_id, fallback_model]:
    try:
        tokenizer = AutoTokenizer.from_pretrained(target)
        model = AutoModelForSequenceClassification.from_pretrained(
            target,
            num_labels=len(labels),
            id2label=id2label,
            label2id=label2id,
            ignore_mismatched_sizes=True
        )
        print(f"✅ Successfully loaded backbone: {{target}}")
        break
    except Exception as e:
        print(f"⚠️ Could not load {{target}} ({{e}}), attempting fallback...")


if model is None or tokenizer is None:
    raise RuntimeError("Failed to load both primary and fallback decision models.")

# Tokenize
def tokenize_batch(examples):
    return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=128)

tokenized_dataset = train_dataset.map(tokenize_batch, batched=True)

# 4. Training Arguments
output_dir = "{output_dir}"
training_args = TrainingArguments(
    output_dir=output_dir,
    num_train_epochs={epochs},
    per_device_train_batch_size={batch_size},
    learning_rate={learning_rate},
    weight_decay=0.01,
    logging_steps=1,
    save_strategy="no",
    report_to="none",
    fp16=torch.cuda.is_available(),
    use_cpu=not torch.cuda.is_available()
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
    processing_class=tokenizer,
)

print(f"🔥 Starting Decision Fine-Tuning loop (Epochs: {epochs})...")
train_result = trainer.train()


print("💾 Saving fine-tuned decision model weights...")
os.makedirs(output_dir, exist_ok=True)
model.config.id2label = id2label
model.config.label2id = label2id
model.save_pretrained(output_dir)
tokenizer.save_pretrained(output_dir)

with open(os.path.join(output_dir, "vspml_meta.json"), "w") as f:
    json.dump({{"labels": labels, "id2label": id2label, "model_id": model_id}}, f, indent=2)

print("=" * 60)
print(f"✅ [VSP ML] Decision Model Training Complete!")
print(f"📈 Final Loss: {{train_result.training_loss:.4f}}")
print(f"📁 Output Saved: {{output_dir}}")
print("=" * 60)
'''
    return script.strip()


def generate_decision_prediction_script(
    text: str,
    model_dir: str = "./laya_decision_model"
) -> str:
    """
    Generates a script to run inference on the fine-tuned decision model on Colab.
    """
    escaped_text = text.replace('"', '\\"').replace("'", "\\'")
    script = f'''
import os
import json
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification

model_path = "{model_dir}"
text_input = "{escaped_text}"

if not os.path.exists(model_path):
    # Fallback to base model for zero-shot decision preview
    model_path = "answerdotai/ModernBERT-base"

meta_file = os.path.join(model_path, "vspml_meta.json")
id2label = {{}}
if os.path.exists(meta_file):
    try:
        with open(meta_file, "r") as f:
            meta = json.load(f)
            raw_id2label = meta.get("id2label", {{}})
            id2label = {{int(k): v for k, v in raw_id2label.items()}}
    except Exception:
        pass

tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForSequenceClassification.from_pretrained(model_path)
model.eval()

if not id2label and hasattr(model.config, "id2label") and model.config.id2label:
    id2label = {{int(k): v for k, v in model.config.id2label.items()}}

inputs = tokenizer(text_input, return_tensors="pt", truncation=True, max_length=128)
with torch.no_grad():
    outputs = model(**inputs)
    probs = F.softmax(outputs.logits, dim=-1).squeeze(0)

# Compute entropy: H(X) = -sum(p * log(p))
eps = 1e-9
entropy = -torch.sum(probs * torch.log(probs + eps)).item()

top_idx = torch.argmax(probs).item()

result = {{
    "input_text": text_input,
    "top_class": id2label.get(top_idx, f"Class_{{top_idx}}"),
    "confidence": float(probs[top_idx].item()),
    "entropy": round(entropy, 4),
    "probabilities": {{
        id2label.get(i, f"Class_{{i}}"): round(probs[i].item(), 4)
        for i in range(len(probs))
    }}
}}

print("###VSPML_PREDICT_START###" + json.dumps(result) + "###VSPML_PREDICT_END###")
'''
    return script.strip()
