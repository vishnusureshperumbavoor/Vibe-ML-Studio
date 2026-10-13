# VibeML 3.0 Expansion Plan
### Zero-VRAM CLI for Decision Model Fine-Tuning via Google Colab MCP

---

## 1. Executive Summary & Vision

**VibeML 3.0** pivots the platform into a globally distributed, terminal-first developer tool: **a lightweight Python CLI that allows developers worldwide to fine-tune System 1 Decision Models (e.g. `convaiinnovations/laya`, ModernBERT) with zero local GPU/VRAM requirements by offloading execution to Google Colab's cloud GPUs via MCP (Model Context Protocol).**

### Why Decision Models (System 1) Instead of Generative LLMs?
| Metric | Generative LLMs (Causal LM) | System 1 Decision Models (Laya / ModernBERT) |
| :--- | :--- | :--- |
| **Primary Task** | Autoregressive text generation | Classification, Triage, Routing, Deterministic Decisions |
| **Inference Latency** | 500ms – 2,500ms (Slow) | **~30ms (Real-time edge ready)** |
| **Hallucination Risk**| High (Unpredictable output) | **Zero (Calibrated softmax probabilities & entropy)** |
| **Model Size** | 1B – 70B+ parameters | **~421M parameters (Ultra-compact footprint)** |
| **Colab T4 Training** | Hours per epoch | **2 – 3 minutes for 1,000 steps** |

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Local Developer Terminal                        │
│                                                                        │
│   $ vibeml connect                                                     │
│   $ vibeml decision train --model convaiinnovations/laya --data triage.csv│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         JSON-RPC   │ (MCP Protocol via Stdio)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        VibeML CLI & MCP Engine                         │
│                                                                        │
│   • Typer / Rich CLI (Interactive Terminal UI, Live Progress Bars)     │
│   • Recipe Generator (ModernBERT / Laya Classification Head Templater) │
│   • Colab MCP Bridge (Daemon managing `colab-mcp` subprocess)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                          WebSocket │ ws://localhost:<port>#mcpProxyToken
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Google Colab Cloud GPU                         │
│                      (Free T4 / A100 / L4 Instances)                   │
│                                                                        │
│   1. Remote dependency hydration (`transformers`, `peft`, `torch`)     │
│   2. Fine-tuning execution (`AutoModelForSequenceClassification`)      │
│   3. Live metric streaming (Loss, Epoch, Macro F1, ECE calibration)    │
│   4. Model weights export (`model.safetensors` & `model.onnx`)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phased Implementation Roadmap

```
Phase 1: CLI Shell & Colab Pair
   │
   ▼
Phase 2: Laya Training Recipe Generator
   │
   ▼
Phase 3: Remote Execution & Live Terminal Streaming
   │
   ▼
Phase 4: Instant Terminal Predict & Validation
   │
   ▼
Phase 5: Packaging & PyPI Global Release
```

---

### Phase 1: CLI Shell & Colab Pairing Handshake

**Goal:** Provide the core `vibeml` binary and establish instantaneous pairing with Google Colab from the terminal.

#### Key Deliverables:
- **CLI Framework:** Initialize package with `typer` and `rich` for sleek, responsive terminal interfaces.
- **`vibeml connect` Command:**
  - Starts the local Colab MCP daemon.
  - Automatically triggers `open_colab_browser_connection` to launch and pair the Colab tab.
  - Awaits WebSocket handshake and verifies connection status.
- **`vibeml status` Command:**
  - Displays connection state, detected Colab GPU specs (T4/V100/A100, VRAM), and available MCP tools in a formatted terminal table.
- **Editable Local Install:**
  - Configure `pyproject.toml` so running `pip install -e .` exposes the global `vibeml` command.

#### Command Example:
```bash
$ vibeml connect
⚡ Initializing VibeML Colab Daemon...
🔗 Opening paired Google Colab session...
🟢 Connected to Google Colab GPU (Tesla T4 | 15.3 GB VRAM | Latency: 42ms)
```

---

### Phase 2: Laya Decision Training Recipe Generator

**Goal:** Create a modular script synthesis engine that produces optimized Python training scripts for `convaiinnovations/laya` (ModernBERT-421M).

#### Key Deliverables:
- **Dataset Preprocessing Template:**
  - Automated parser for CSV, JSONL, and TSV files.
  - Automatic detection and mapping of text columns and target class labels.
  - Stratified train/validation splitting.
- **Laya Classification Architecture:**
  - Configures `AutoModelForSequenceClassification` with ModernBERT pooling.
  - Support for single-label multi-class triage and multi-label routing matrices.
  - Class-weighted Cross-Entropy / Focal Loss to handle imbalanced datasets.
- **Fast Training Hyperparameters:**
  - Mixed precision (`fp16` / `bf16`).
  - Learning rate scheduling with AdamW + linear warmup.
  - Evaluation hooks computing Macro F1, Precision, Recall, and Expected Calibration Error (ECE).
- **Dual Export Pipeline:**
  - PyTorch Safetensors (`model.safetensors`).
  - Automated ONNX export (`model.onnx`) for production ~30ms inference.

---

### Phase 3: Remote Execution & Live Terminal Streaming

**Goal:** Implement `vibeml decision train` to send the generated recipe across the Colab MCP bridge, execute it on the cloud GPU, and stream real-time progress back to the user's terminal.

#### Key Deliverables:
- **`vibeml decision train` CLI Interface:**
  - Direct arguments (`--base-model`, `--data`, `--text-col`, `--label-col`, `--epochs`, `--batch-size`, `--lr`).
  - Config file support via YAML (`vibeml-decision.yaml`).
- **Remote Code Injection:**
  - Serializes dataset samples and training logic.
  - Uses `internal_colab_client.execute_code()` to create and trigger code cells inside Colab.
- **Live Terminal Telemetry:**
  - Parses standard output streams from Colab in real-time.
  - Renders interactive `rich` progress bars, loss curves, and epoch timers in the terminal.
- **Artifact Handshake:**
  - Downloads the trained model artifacts locally to `./models/<run-name>/` or automatically pushes them to Hugging Face Hub (`--push-to-hf`).

#### Command Example:
```bash
$ vibeml decision train \
    --base-model convaiinnovations/laya \
    --data ./datasets/triage.csv \
    --text-col "patient_presentation" \
    --label-col "triage_priority" \
    --epochs 3 \
    --output ./models/laya-triage-v1

🚀 Pushing training payload to Google Colab GPU...
📦 Hydrating remote runtime with dependencies... Done (9.4s)
🧠 Initializing convaiinnovations/laya (ModernBERT-421M)...
📊 Dataset loaded: 1,850 samples across 3 classes: [emergent, urgent, routine]

🔥 Training Progress:
Epoch 1/3 [━━━━━━━━━━━━━━━━━━━━] Loss: 0.421 | Val F1: 0.884 | Step: 115/115
Epoch 2/3 [━━━━━━━━━━━━━━━━━━━━] Loss: 0.218 | Val F1: 0.931 | Step: 230/230
Epoch 3/3 [━━━━━━━━━━━━━━━━━━━━] Loss: 0.129 | Val F1: 0.962 | Step: 345/345

✅ Training finished in 2m 14s!
💾 Saved Model Artifacts:
   ├── ./models/laya-triage-v1/model.safetensors (804 MB)
   ├── ./models/laya-triage-v1/model.onnx        (804 MB)
   └── ./models/laya-triage-v1/labels.json
```

---

### Phase 4: Instant Terminal Testing & Validation

**Goal:** Enable developers to run instant inference against their newly trained decision model directly from the command line.

#### Key Deliverables:
- **`vibeml decision predict` Command:**
  - Evaluates single test strings or batches against the local or Colab-hosted model.
  - Displays class probability distributions, entropy (uncertainty score), and top decision category.
- **Interactive Triage Shell (`vibeml decision play`):**
  - Interactive REPL where users can type raw sentences and receive instant sub-30ms decision classifications.

#### Command Example:
```bash
$ vibeml decision predict \
    --model ./models/laya-triage-v1 \
    --text "Sudden severe chest pain radiating to left arm with shortness of breath"

Decision Output:
┌──────────────┬────────────┬──────────────────────────────┐
│ Category     │ Confidence │ Visual Distribution          │
├──────────────┼────────────┼──────────────────────────────┤
│ emergent     │ 98.2%      │ ████████████████████████████ │
│ urgent       │  1.5%      │ ▏                            │
│ routine      │  0.3%      │                              │
└──────────────┴────────────┴──────────────────────────────┘
• Decision: emergent
• Confidence: 98.2% (High Confidence)
• Entropy: 0.082 (Low Uncertainty)
• Latency: 29.4ms
```

---

### Phase 5: Packaging & PyPI Global Distribution

**Goal:** Distribute VibeML worldwide via PyPI with zero configuration.

#### Key Deliverables:
- **PyPI Release:** `pip install vibeml` available globally.
- **Zero-Dependency Core:** Keeps local installation under ~10MB (only `typer`, `rich`, `fastapi`, `uvicorn`, `httpx`, `pydantic`). Heavy ML dependencies (`torch`, `transformers`) stay remote on Colab.
- **Documentation & Quickstart:** Clear GitHub README, quickstart guide, and sample decision datasets.

---

## 4. Summary Matrix

| Milestone | Target Feature | Core Tech Stack |
| :--- | :--- | :--- |
| **Phase 1** | Colab MCP Pairing CLI | Python, Typer, Rich, MCP Client |
| **Phase 2** | Laya Training Recipe Generator | ModernBERT, PyTorch, Hugging Face Transformers |
| **Phase 3** | Remote Colab Training & Streaming | Colab MCP RPC, Rich Progress Telemetry |
| **Phase 4** | Decision Prediction REPL | ONNX Runtime / Safetensors, Rich Tables |
| **Phase 5** | PyPI Publishing & Docs | `pyproject.toml`, Flit / Hatch, GitHub Releases |
