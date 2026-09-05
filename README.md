# Vibe ML Studio 🚀

Local SLM Post-Training, Distillation, Quantization & Interactive Inference IDE.

---

## ⚡ Quickstart (Multi-Tab Workflow)

All services can be started from the **root directory** across 3 dedicated terminal tabs:

### 1. Daily Development (Fast Start)

| Terminal Tab | Command | Description |
| :--- | :--- | :--- |
| **Tab 1: Server** | `npm run start:server` | Launches FastAPI Backend & Python Kernel (`http://127.0.0.1:2000`) |
| **Tab 2: MCP** | `npm run start:mcp` | Launches MCP Bridge Service (`http://127.0.0.1:3001`) |
| **Tab 3: Client** | `npm run start` | Launches Vite Frontend UI (`http://localhost:5173`) |

---

### 2. First-Time Setup (Install Dependencies & Start)

Add `--install` to automatically install all dependencies before starting:

| Terminal Tab | Command | Description |
| :--- | :--- | :--- |
| **Tab 1: Server** | `npm run start:server --install` | Sets up Python venv, installs PyTorch/TRL & starts server |
| **Tab 2: MCP** | `npm run start:mcp --install` | Installs MCP dependencies & starts bridge |
| **Tab 3: Client** | `npm run start --install` | Installs root npm dependencies & starts Vite |

---

## 🛠️ Build & Verification

```bash
npm run build     # Runs tsc --noEmit && vite build
npm run preview   # Preview production bundle locally
```
