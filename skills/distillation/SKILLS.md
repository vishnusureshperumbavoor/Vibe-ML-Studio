# Distillation Skills

**Description:** Technical reference for Teacher-Student knowledge transfer.

## Core Utilities
- **Synthetic Dataset Generation:** Logic for prompting Teacher models to generate high-quality chain-of-thought data.
- **Logit Capture:** Tools for saving the output logits of large models for offline distillation.
- **Student Initialization:** Best practices for selecting student models (e.g., Qwen2, Gemma-2B).

## VML-Native Implementation
Distillation in VML Studio is managed by the `distillation_service.py`, which orchestrates the teacher-student interaction.
