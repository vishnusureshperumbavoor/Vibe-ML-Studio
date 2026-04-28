# Hugging Face NLP & Foundational Models Skill

**Description:** Use this skill for fetching high-volume text, audio, and multimodal datasets, or pre-trained architectures from the Hugging Face ecosystem.

## Workflow Rules & Guidelines
1. **Dependencies:** The pipeline must handle `pip install datasets transformers huggingface_hub`.
2. **Token Injection:** Some datasets are gated. Authenticate optimally if needed:
   ```python
   from huggingface_hub import login
   import os
   
   hf_token = os.getenv("HF_TOKEN")
   if hf_token:
       login(token=hf_token)
   ```
3. **Dataset Streaming (CRITICAL FOR LARGE DATA):** Do not download entire terabyte-scale datasets directly into RAM. Use the `streaming=True` flag for massive datasets to process them on the fly:
   ```python
   from datasets import load_dataset
   
   # Using streaming to prevent OOM (Out of Memory)
   dataset = load_dataset("<ORG/DATASET_NAME>", split="train", streaming=True)
   
   # Use traditional downloading for smaller datasets
   # dataset = load_dataset("<ORG/DATASET_NAME>", split="train")
   ```
4. **Tokenization Sync:** The agent MUST ensure the dataset tokenizer matches the model checkpoint exactly.
   ```python
   from transformers import AutoTokenizer
   tokenizer = AutoTokenizer.from_pretrained("<MODEL_CHECKPOINT>")
   ```
