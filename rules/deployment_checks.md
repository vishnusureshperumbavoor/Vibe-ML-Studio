# Deployment Checkpoints

**Rule 1: Step Threshold**
Only trigger automated Hugging Face deployment if the training run exceeded **300 steps**. This prevents "spamming" the hub with experimental or incomplete runs.

**Rule 2: Readme Accuracy**
Every deployed model must include an auto-generated `README.md` that correctly identifies the base model and training dataset.

**Rule 3: Credential Safety**
Never hardcode `HF_TOKEN` in the deployment scripts. Always fetch it from the environment or `.env` file.
