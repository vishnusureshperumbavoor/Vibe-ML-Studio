# VSP ML
### Zero-VRAM Decision Model Fine-Tuning CLI via Google Colab MCP

**VSP ML** is a terminal-first developer CLI created by Vishnu Suresh Perumbavoor that allows developers to fine-tune **System 1 Decision Models** (like `convaiinnovations/laya` and ModernBERT) with **zero local GPU or VRAM requirements** by offloading compute directly to Google Colab's cloud GPUs via the Model Context Protocol (MCP).

---

## ⚡ Quickstart

### 1. Installation
```bash
pip install vspml
```

### 2. Pair with Google Colab Cloud GPU
```bash
vspml connect
```
This automatically establishes a persistent Model Context Protocol (MCP) bridge with your Google Colab runtime.

### 3. Check Connection & Status
```bash
vspml status
```

---

## 🎯 Why Decision Models (System 1)?
- **~30ms Latency**: Non-autoregressive classification and routing.
- **Zero Hallucinations**: Calibrated probability distributions and entropy metrics.
- **Cost Effective**: Runs and trains on standard free/Pro Colab GPU tiers in minutes.

---

## 📦 License
MIT License © 2026 Vishnu Suresh Perumbavoor.
