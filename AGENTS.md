# Agent Rules & Execution Directives

## Terminal & Command Execution Policy
- **DO NOT ASK FOR USER PERMISSION BEFORE EXECUTING TERMINAL COMMANDS.**
- Execute all safe terminal commands, build checks, type checks, tests, status checks, background daemons, dataset inspections, and environment scripts autonomously and proactively.
- Never pause to prompt or request user confirmation before running terminal commands.

## Fast Model Training & Persona Dataset Playbook
When preparing datasets or training persona/task models:
1. **Dataset Extraction**:
   Use `vspagent dataset parse-whatsapp -i <dir_or_file> -a "<Target User>" -o <output.jsonl>`.
   - Parses multi-turn conversations into ChatML format in < 1 second.
   - Automatically masks phone numbers (`[PHONE]`) and emails (`[EMAIL]`).
2. **One-Shot Cloud Fine-Tuning**:
   Use `vspagent train --backend jarvis --gpu A30 --dataset <jsonl> --base-model <hf_id> --epochs <N> --push-to-hf <repo_id> --auto-pause`.
   - Native Zero-System-Prompt ChatML format.
   - Assistant-only loss masking (-100 on user tokens).
   - Automatic LoRA merge and `q4_k_m` GGUF quantization.
   - Dual-transport networking: automatically uses Jupyter HTTPS/WebSocket over Port 443 if SSH Port 22 is blocked.
   - Automatically pauses GPU billing immediately upon Hugging Face upload.
3. **Transformers v5 Compatibility Directives**:
   - Use `warmup_steps=10` instead of `warmup_ratio`.
   - Always sanitize `tokenizer_config.json` (`extra_special_tokens = {}`) before invoking llama.cpp `convert_hf_to_gguf.py`.

