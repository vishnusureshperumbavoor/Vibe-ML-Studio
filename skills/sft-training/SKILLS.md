# SFT Training Skills

**Description:** Technical reference for Unsloth, PEFT, and TRL-based fine-tuning.

## Core Utilities
- **Dataset Formatting:** Tools for converting raw JSONL/CSV into Alpaca-style instruction datasets.
- **LoRA Configuration:** Best practices for setting `target_modules` (q_proj, v_proj, etc.) based on model architecture.
- **Gradient Accumulation:** Techniques for training on large datasets with limited batch sizes.

## VML-Native Implementation
Reference the `server/agent_orchestrator.py` for the current implementation of the automated SFT block generation.
