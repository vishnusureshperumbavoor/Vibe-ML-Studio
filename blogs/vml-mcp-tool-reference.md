# VML MCP Tool Reference: The Intelligence Catalog

This document serves as a technical reference for the tools exposed by the **Vibe ML MCP Server**. These tools can be called by any MCP-compliant client (Claude Desktop, Cursor, etc.) to perform autonomous fine-tuning, knowledge retrieval, and model management.

## 🔎 Discovery Tools

### `model_search`
*   **Description**: Search for models on the Hugging Face Hub. Returns structured metadata including download counts and CPU-readiness flags.
*   **Parameters**:
    *   `query` (string): The search term (e.g., "Qwen").
    *   `limit` (integer): Max results to return.

### `dataset_search`
*   **Description**: Search for training datasets on the Hugging Face Hub.
*   **Parameters**:
    *   `query` (string): The search term (e.g., "medical JSONL").
    *   `limit` (integer): Max results to return.

## 🏋️ Training & Provisioning Tools

### `start_sft_job`
*   **Description**: Generates a complete Supervised Fine-Tuning (SFT) Python notebook block with LoRA support.
*   **Parameters**:
    *   `base_model` (string): Hugging Face Model ID.
    *   `dataset_id` (string): Hugging Face or local dataset ID.
    *   `hardware_target` (string): 'CPU' or 'GPU'.
    *   `max_steps` (integer): Training steps (Note: 300+ steps trigger autonomous cloud deployment).
    *   `rank` (integer): LoRA adaptation rank.

### `start_quantization_job`
*   **Description**: Generates a script to quantize a trained model into GGUF format.
*   **Parameters**:
    *   `model_id` (string): The model to quantize.
    *   `bits` (string): Target bit-rate (e.g., '4').

### `fetch_gguf`
*   **Description**: Directly downloads a pre-optimized GGUF model into the VML local storage.
*   **Parameters**:
    *   `repo_id` (string): HF Repo ID.
    *   `filename` (string): Specific GGUF file.

## 📚 Knowledge & RAG Tools

### `ingest_knowledge`
*   **Description**: Mines text from a PDF or URL and indexes it into the VML local vector database.
*   **Parameters**:
    *   `source` (string): URL or local file path.
    *   `collection` (string): The target vector database name.

### `search_knowledge`
*   **Description**: Performs a semantic "Vibe Search" across your indexed knowledge.
*   **Parameters**:
    *   `query` (string): Natural language question.
    *   `collection` (string): The database to search.

### `list_knowledge_collections`
*   **Description**: Returns a list of all currently indexed knowledge bases in your local environment.

## 🖥️ System Awareness

### `get_system_specs`
*   **Description**: Returns real-time hardware data (CPU cores, RAM availability, and GPU VRAM). Agents use this to decide which models are safe to run locally.

---
*Vibe ML: Standardizing Agentic Intelligence via MCP.*
