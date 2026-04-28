# Kaggle Competitions & Datasets Skill

**Description:** Use this skill primarily for downloading structured tabular data, specialized open datasets, and competition frameworks directly from the Kaggle API.

## Workflow Rules & Guidelines
1. **Dependencies:** Ensure `kaggle` is installed (`pip install kaggle`).
2. **Credential Injection:** The Kaggle API traditionally relies on `~/.kaggle/kaggle.json`. For autonomous orchestration, dynamically inject credentials via the OS environment instead:
   ```python
   import os
   
   # Secure injection
   os.environ['KAGGLE_USERNAME'] = os.getenv("KAGGLE_USERNAME", "default_user")
   os.environ['KAGGLE_KEY'] = os.getenv("KAGGLE_KEY", "default_key")
   ```
3. **API Downloader Boilerplate:** Use the native python API instead of unstable terminal commands to ensure the orchestrator can catch download success/failures.
   ```python
   import kaggle
   kaggle.api.authenticate()
   
   # Auto-extracting the dataset to standard /data directory
   kaggle.api.dataset_download_files('<OWNER/DATASET_NAME>', path='./data', unzip=True)
   
   # Alternative for Competitions
   # kaggle.api.competition_download_files('<COMPETITION_NAME>', path='./data')
   ```
4. **User Interruption Check:** If the competition download fails with a 403 Forbidden, the agent MUST halt the orchestration and ask the user to manually "Accept the Rules" on the Kaggle website.
