import json
from typing import Dict, Any, Optional, List

BLURB_LEADERBOARD_STANDINGS = [
    {
        "rank": 1,
        "model": "BioLinkBERT-Large (Stanford)",
        "blurb_score": 84.30,
        "qa_accuracy": 83.50,
        "class_score": 84.88,
        "architecture": "Encoder (BERT-Large)",
        "params": "340M"
    },
    {
        "rank": 2,
        "model": "BioM-ALBERT-xxlarge (Univ Delaware)",
        "blurb_score": 84.10,
        "qa_accuracy": 85.20,
        "class_score": 83.06,
        "architecture": "Encoder (ALBERT)",
        "params": "223M"
    },
    {
        "rank": 3,
        "model": "BioM-ELECTRA-Large (Univ Delaware)",
        "blurb_score": 83.81,
        "qa_accuracy": 84.00,
        "class_score": 84.03,
        "architecture": "Encoder (ELECTRA)",
        "params": "335M"
    },
    {
        "rank": 5,
        "model": "BioLinkBERT-Base (Stanford)",
        "blurb_score": 83.39,
        "qa_accuracy": 80.81,
        "class_score": 84.35,
        "architecture": "Encoder (BERT-Base)",
        "params": "110M"
    },
    {
        "rank": 8,
        "model": "MSR BiomedBERT / PubMedBERT (Microsoft)",
        "blurb_score": 82.75,
        "qa_accuracy": 77.86,
        "class_score": 83.02,
        "architecture": "Encoder (BERT-Base)",
        "params": "110M"
    },
    {
        "rank": 9,
        "model": "BioELECTRA-Base (Saama Research)",
        "blurb_score": 82.60,
        "qa_accuracy": 76.38,
        "class_score": 84.20,
        "architecture": "Encoder (ELECTRA)",
        "params": "110M"
    },
    {
        "rank": "🎯",
        "model": "VSP ML (Laya / ModernBERT)",
        "blurb_score": "In Progress",
        "qa_accuracy": "Targeting >80%",
        "class_score": "Targeting >84%",
        "architecture": "ModernBERT + FlashAttention",
        "params": "149M"
    }
]


def generate_blurb_pubmedqa_training_script(
    model_id: str = "convaiinnovations/laya",
    epochs: int = 4,
    learning_rate: float = 3e-5,
    batch_size: int = 8,
    max_length: int = 512,
    output_dir: str = "./laya_blurb_pubmedqa"
) -> str:
    """
    Generates a Colab GPU recipe to train on the official Microsoft BLURB
    PubMedQA benchmark split (450 train, 50 dev, 500 test) and evaluate test accuracy.
    """
    return f'''
import sys
import os
import json
import urllib.request
import torch

print("🧪 [Colab GPU] Starting Microsoft BLURB - PubMedQA Benchmark Run...")
print(f"📦 PyTorch: {{torch.__version__}} | Device: {{'cuda' if torch.cuda.is_available() else 'cpu'}}")
if torch.cuda.is_available():
    print(f"⚡ GPU: {{torch.cuda.get_device_name(0)}} ({{round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2)}} GB)")
else:
    print("⚠️  [NOTICE] Colab is running in CPU mode.")
    print("👉  Tip: Switch to free T4 GPU in Colab via: Runtime -> Change runtime type -> T4 GPU")


# 1. Install required packages
import subprocess
packages = ["transformers", "datasets", "accelerate", "scikit-learn", "sentencepiece", "tiktoken"]
for pkg in packages:
    try:
        __import__(pkg)
    except ImportError:
        print(f"📦 Installing {{pkg}}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pkg])

import datasets
import numpy as np
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Trainer,
    TrainingArguments
)

# 2. Fetch the Official 500-sample BLURB Test Set IDs
gt_url = "https://raw.githubusercontent.com/pubmedqa/pubmedqa/master/data/test_ground_truth.json"
try:
    req = urllib.request.urlopen(gt_url)
    test_gt = json.loads(req.read().decode('utf-8'))
    test_pmids = set(str(k) for k in test_gt.keys())
    print(f"✅ Loaded Official BLURB Test Set Partition ({{len(test_pmids)}} PMIDs)")
except Exception as e:
    print(f"⚠️ Could not load remote test_ground_truth.json ({{e}}), using deterministic fallback.")
    test_pmids = None

# 3. Load PubMedQA labeled dataset (1000 expert annotations)
print("📥 Loading qiaojin/PubMedQA (pqa_labeled)...")
raw_ds = datasets.load_dataset("qiaojin/PubMedQA", "pqa_labeled", split="train")

labels = ["yes", "no", "maybe"]
label2id = {{"yes": 0, "no": 1, "maybe": 2}}
id2label = {{0: "yes", 1: "no", 2: "maybe"}}

# 4. Partition into 450 Train, 50 Dev, 500 Test
all_samples = []
for item in raw_ds:
    ctx = " ".join(item["context"]["contexts"])
    input_text = f"Question: {{item['question']}}\\nContext: {{ctx}}"
    lbl = item["final_decision"].lower().strip()
    if lbl not in label2id:
        continue
    all_samples.append({{
        "pubid": str(item["pubid"]),
        "text": input_text,
        "label": label2id[lbl]
    }})

if test_pmids:
    test_records = [x for x in all_samples if x["pubid"] in test_pmids]
    train_dev_records = [x for x in all_samples if x["pubid"] not in test_pmids]
else:
    np.random.seed(42)
    indices = np.random.permutation(len(all_samples))
    test_records = [all_samples[i] for i in indices[:500]]
    train_dev_records = [all_samples[i] for i in indices[500:]]

np.random.seed(42)
shuffled_td = np.random.permutation(len(train_dev_records))
train_records = [train_dev_records[i] for i in shuffled_td[:450]]
dev_records = [train_dev_records[i] for i in shuffled_td[450:500]]

print(f"📊 Partitions: Train={{len(train_records)}} | Dev={{len(dev_records)}} | Official Test={{len(test_records)}}")

# 5. Tokenizer & Model Initialization
model_id = "{model_id}"
print(f"🧠 Loading Backbone: {{model_id}}...")
try:
    tokenizer = AutoTokenizer.from_pretrained(model_id)
except Exception:
    fallback = "answerdotai/ModernBERT-base"
    print(f"⚠️ Falling back to {{fallback}}")
    model_id = fallback
    tokenizer = AutoTokenizer.from_pretrained(fallback)

if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token or "[PAD]"

model = AutoModelForSequenceClassification.from_pretrained(
    model_id,
    num_labels=3,
    id2label=id2label,
    label2id=label2id
)

eff_max_len = 128 if not torch.cuda.is_available() else {max_length}

def tokenize_batch(records):
    texts = [r["text"] for r in records]
    enc = tokenizer(texts, padding="max_length", truncation=True, max_length=eff_max_len)
    enc["labels"] = [r["label"] for r in records]
    return enc


train_enc = tokenize_batch(train_records)
dev_enc = tokenize_batch(dev_records)
test_enc = tokenize_batch(test_records)

class DatasetFromEnc(torch.utils.data.Dataset):
    def __init__(self, enc):
        self.enc = enc
    def __len__(self):
        return len(self.enc["input_ids"])
    def __getitem__(self, idx):
        return {{k: torch.tensor(v[idx]) for k, v in self.enc.items()}}

train_dataset = DatasetFromEnc(train_enc)
dev_dataset = DatasetFromEnc(dev_enc)
test_dataset = DatasetFromEnc(test_enc)

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    acc = accuracy_score(labels, preds)
    macro_f1 = f1_score(labels, preds, average="macro", zero_division=0)
    return {{"accuracy": acc, "macro_f1": macro_f1}}

from transformers import TrainerCallback

class PlainTextCallback(TrainerCallback):
    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs:
            ep = logs.get("epoch", 0)
            loss = logs.get("loss", logs.get("eval_loss", None))
            acc = logs.get("eval_accuracy", None)
            line = f"• [Epoch {{round(ep, 2)}} | Step {{state.global_step}}]"
            if loss is not None:
                line += f" Loss: {{round(loss, 4)}}"
            if acc is not None:
                line += f" | Val Acc: {{round(acc * 100, 2)}}%"
            print(line)

from collections import Counter
counts = Counter([r["label"] for r in train_records])
tot = len(train_records)
weights_list = [tot / (3.0 * max(1, counts.get(i, 1))) for i in range(3)]
class_weights_tensor = torch.tensor(weights_list, dtype=torch.float)
print(f"⚖️ Balanced Class Weights: yes={{round(weights_list[0], 2)}}, no={{round(weights_list[1], 2)}}, maybe={{round(weights_list[2], 2)}}")

class WeightedTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        labels = inputs.get("labels")
        outputs = model(**inputs)
        logits = outputs.logits
        loss_fct = torch.nn.CrossEntropyLoss(weight=class_weights_tensor.to(model.device))
        loss = loss_fct(logits, labels)
        return (loss, outputs) if return_outputs else loss

output_dir = "{output_dir}"
training_args = TrainingArguments(
    output_dir=output_dir,
    eval_strategy="epoch",
    save_strategy="epoch",
    learning_rate={learning_rate},
    per_device_train_batch_size={batch_size},
    per_device_eval_batch_size={batch_size * 2},
    num_train_epochs={epochs},
    weight_decay=0.01,
    warmup_steps=10,
    logging_steps=5,
    save_total_limit=1,
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
    greater_is_better=True,
    report_to=[],
    disable_tqdm=True,
    fp16=torch.cuda.is_available()
)

trainer = WeightedTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=dev_dataset,
    processing_class=tokenizer,
    compute_metrics=compute_metrics,
    callbacks=[PlainTextCallback()]
)



print(f"🚀 Training for {epochs} epochs on Colab GPU...")
train_result = trainer.train()

print(f"💾 Saving fine-tuned benchmark model to {{output_dir}}...")
trainer.save_model(output_dir)
tokenizer.save_pretrained(output_dir)

# 6. Evaluate on Official 500-Sample Test Set
print("🎯 Evaluating on Official 500-sample BLURB Test Set...")
test_preds_raw = trainer.predict(test_dataset)
test_logits = test_preds_raw.predictions
test_labels = test_preds_raw.label_ids
predicted_classes = np.argmax(test_logits, axis=-1)

final_accuracy = float(accuracy_score(test_labels, predicted_classes))
final_macro_f1 = float(f1_score(test_labels, predicted_classes, average="macro", zero_division=0))

f1_per_class = f1_score(test_labels, predicted_classes, average=None, zero_division=0)
class_breakdown = {{
    "yes": float(f1_per_class[0]),
    "no": float(f1_per_class[1]),
    "maybe": float(f1_per_class[2])
}}

print(f"🏁 TEST ACCURACY: {{round(final_accuracy * 100, 2)}}%")
print(f"🏁 TEST MACRO-F1: {{round(final_macro_f1 * 100, 2)}}%")

results = {{
    "model_id": model_id,
    "benchmark": "Microsoft BLURB (PubMedQA)",
    "test_samples": len(test_records),
    "accuracy": final_accuracy,
    "accuracy_pct": round(final_accuracy * 100, 2),
    "macro_f1": final_macro_f1,
    "macro_f1_pct": round(final_macro_f1 * 100, 2),
    "class_f1": class_breakdown,
    "train_epochs": {epochs},
    "output_dir": output_dir,
    "baselines": {{
        "BioLinkBERT_Large": 83.50,
        "BioLinkBERT_Base": 80.81,
        "PubMedBERT": 77.86,
        "BioELECTRA": 76.38
    }}
}}

print("###VSPML_BLURB_RESULT_START###")
print(json.dumps(results))
print("###VSPML_BLURB_RESULT_END###")
'''


def generate_blurb_predict_script(
    question: str,
    context: str,
    model_dir: str = "./laya_blurb_pubmedqa"
) -> str:
    """
    Generates a Colab script to predict clinical verdict ('yes', 'no', 'maybe')
    for a research question and abstract context using the fine-tuned model.
    """
    clean_q = json.dumps(question)
    clean_ctx = json.dumps(context)
    clean_model_dir = json.dumps(model_dir)

    return f'''
import os
import json
import torch
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification

question = {clean_q}
context = {clean_ctx}
model_dir = {clean_model_dir}

device = "cuda" if torch.cuda.is_available() else "cpu"

tokenizer = AutoTokenizer.from_pretrained(model_dir)
model = AutoModelForSequenceClassification.from_pretrained(model_dir).to(device)
model.eval()

input_text = f"Question: {{question}}\\nContext: {{context}}"
inputs = tokenizer(input_text, return_tensors="pt", truncation=True, max_length=512).to(device)

with torch.no_grad():
    outputs = model(**inputs)
    logits = outputs.logits
    probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]

id2label = model.config.id2label
top_idx = int(np.argmax(probs))
top_class = id2label[top_idx]
confidence = float(probs[top_idx])

# Calculate Shannon Entropy
p_clean = np.clip(probs, 1e-12, 1.0)
entropy = float(-np.sum(p_clean * np.log2(p_clean)))

prob_dict = {{id2label[i]: float(probs[i]) for i in range(len(probs))}}

result = {{
    "question": question,
    "top_class": top_class,
    "confidence": round(confidence, 4),
    "entropy": round(entropy, 4),
    "probabilities": {{k: round(v, 4) for k, v in prob_dict.items()}}
}}

print("###VSPML_PREDICT_START###")
print(json.dumps(result))
print("###VSPML_PREDICT_END###")
'''
