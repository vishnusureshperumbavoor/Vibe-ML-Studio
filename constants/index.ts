import { ConnectorConfig, PluginDefinition, CellData } from "../types";

export const API_BASE = "http://127.0.0.1:2000";

export const INITIAL_CONNECTORS: ConnectorConfig[] = [
  {
    id: "huggingface",
    label: "Hugging Face MCP",
    description: "Local bridge for Hugging Face Hub tools (models/datasets).",
    url: "http://127.0.0.1:3001",
    enabled: true,
    status: "idle",
    tokenHint: "Set HF_TOKEN",
  },
  {
    id: "kaggle",
    label: "Kaggle MCP",
    description:
      "Local bridge for Kaggle datasets, competitions, and notebooks.",
    url: "http://127.0.0.1:1002",
    enabled: true,
    status: "idle",
    tokenHint: "Set KAGGLE_API_TOKEN",
  },
  {
    id: "roboflow",
    label: "Roboflow MCP",
    description:
      "Local Roboflow inference bridge (object detection/classification).",
    url: "http://127.0.0.1:1003",
    enabled: true,
    status: "idle",
    tokenHint: "Set ROBOFLOW_API_KEY",
  },
];

export const CONNECTOR_PLUGINS: PluginDefinition[] = [
  {
    id: "plugin-huggingface",
    name: "Hugging Face Plugin",
    description: "Expose Hugging Face search + metadata tools.",
    connectors: ["huggingface"],
    skills: ["huggingface"],
  },
  {
    id: "plugin-kaggle",
    name: "Kaggle Plugin",
    description: "Surface Kaggle competitions/datasets/benchmarks.",
    connectors: ["kaggle"],
    skills: ["kaggle"],
  },
  {
    id: "plugin-roboflow",
    name: "Roboflow Plugin",
    description: "Bundle Roboflow inference with helper instructions.",
    connectors: ["roboflow"],
    skills: ["roboflow"],
  },
];

export const INITIAL_CELLS: CellData[] = [];

export interface HubRecommendedModel {
  id: string;
  filename: string;
  name: string;
  display_name: string;
  repo_id: string;
  type: "base";
  architecture: string;
  quantization: string;
  parameters: string;
  size_mb: number;
  context_length: string;
  description: string;
  hf_url: string;
  tags: string[];
}

export const HUB_RECOMMENDED_MODELS: HubRecommendedModel[] = [
  {
    id: "convaiinnovations/laya",
    filename: "model.safetensors",
    name: "Laya System 1 Decision Model",
    display_name: "Laya 421M System 1",
    repo_id: "convaiinnovations/laya",
    type: "base",
    architecture: "ModernBERT (System 1)",
    quantization: "PyTorch / Safetensors",
    parameters: "421M",
    size_mb: 804,
    context_length: "8K",
    description: "Non-autoregressive System 1 decision engine (~33ms latency). Optimized for classification, triage, and structured decision primitives.",
    hf_url: "https://huggingface.co/convaiinnovations/laya",
    tags: ["System 1", "Decision Engine", "Triage", "421M"],
  },
  {
    id: "Qwen/Qwen2-0.5B-Instruct-GGUF",
    filename: "qwen2-0_5b-instruct-q4_k_m.gguf",
    name: "Qwen2 0.5B Instruct",
    display_name: "Qwen2 0.5B Instruct (System 2)",
    repo_id: "Qwen/Qwen2-0.5B-Instruct-GGUF",
    type: "base",
    architecture: "Qwen2",
    quantization: "Q4_K_M",
    parameters: "0.5B",
    size_mb: 379,
    context_length: "32K",
    description: "Compact autoregressive System 2 generative language model for conversational instruction following.",
    hf_url: "https://huggingface.co/Qwen/Qwen2-0.5B-Instruct-GGUF",
    tags: ["System 2", "LLM", "CPU Ready", "Starter", "Q4_K_M"],
  },
  {
    id: "prism-ml/Bonsai-1.7B-gguf",
    filename: "Bonsai-1.7B-Q1_0.gguf",
    name: "Prism ML Bonsai 1.7B",
    display_name: "Prism ML Bonsai 1.7B (System 2)",
    repo_id: "prism-ml/Bonsai-1.7B-gguf",
    type: "base",
    architecture: "Bonsai (1-bit)",
    quantization: "Q1_0 (1-bit)",
    parameters: "1.7B",
    size_mb: 256,
    context_length: "32K",
    description: "Extreme low-bit 1-bit quantized System 2 generative SLM with a ~250 MB footprint.",
    hf_url: "https://huggingface.co/prism-ml/Bonsai-1.7B-gguf",
    tags: ["System 2", "LLM", "1-bit Quantized", "Edge Ready", "~250 MB"],
  },
  {
    id: "unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
    filename: "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    name: "DeepSeek-R1 Distill Qwen 1.5B",
    display_name: "DeepSeek R1 1.5B (System 2)",
    repo_id: "unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
    type: "base",
    architecture: "Qwen2 (DeepSeek-R1)",
    quantization: "Q4_K_M",
    parameters: "1.5B",
    size_mb: 1120,
    context_length: "32K",
    description: "System 2 reasoning model with built-in multi-step chain-of-thought verification.",
    hf_url: "https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
    tags: ["System 2", "Reasoning", "Chain-of-Thought", "DeepSeek-R1"],
  },
  {
    id: "Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF",
    filename: "qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
    name: "Qwen2.5 Coder 1.5B Instruct",
    display_name: "Qwen2.5 Coder 1.5B (System 2)",
    repo_id: "Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF",
    type: "base",
    architecture: "Qwen2.5-Coder",
    quantization: "Q4_K_M",
    parameters: "1.5B",
    size_mb: 980,
    context_length: "32K",
    description: "System 2 code intelligence and logic model for multi-step software synthesis.",
    hf_url: "https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF",
    tags: ["System 2", "Coding", "Reasoning", "Qwen2.5"],
  },
  {
    id: "city96/FLUX.1-schnell-gguf",
    filename: "flux1-schnell-Q4_0.gguf",
    name: "FLUX.1 Schnell GGUF",
    display_name: "FLUX.1 Schnell (Image Gen)",
    repo_id: "city96/FLUX.1-schnell-gguf",
    type: "base",
    architecture: "FLUX Diffusion",
    quantization: "Q4_0",
    parameters: "12B",
    size_mb: 6800,
    context_length: "N/A",
    description: "State-of-the-art text-to-image diffusion generation model quantized for local inference.",
    hf_url: "https://huggingface.co/city96/FLUX.1-schnell-gguf",
    tags: ["Image Generation", "Diffusion", "FLUX", "Text-to-Image"],
  },
  {
    id: "stable-diffusion-v1-5/stable-diffusion-v1-5",
    filename: "v1-5-pruned-emaonly.safetensors",
    name: "Stable Diffusion v1.5",
    display_name: "Stable Diffusion v1.5 (Image Gen)",
    repo_id: "stable-diffusion-v1-5/stable-diffusion-v1-5",
    type: "base",
    architecture: "Latent Diffusion",
    quantization: "FP16 / Safetensors",
    parameters: "1.0B",
    size_mb: 4270,
    context_length: "N/A",
    description: "High-speed local diffusion model for real-time creative text-to-image generation.",
    hf_url: "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5",
    tags: ["Image Generation", "Diffusion", "Stable Diffusion", "Text-to-Image"],
  },
];

