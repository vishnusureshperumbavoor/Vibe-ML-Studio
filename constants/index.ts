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
    id: "Qwen/Qwen2-0.5B-Instruct-GGUF",
    filename: "qwen2-0_5b-instruct-q4_k_m.gguf",
    name: "Qwen2 0.5B Instruct",
    display_name: "Qwen2 0.5B Instruct",
    repo_id: "Qwen/Qwen2-0.5B-Instruct-GGUF",
    type: "base",
    architecture: "Qwen2",
    quantization: "Q4_K_M",
    parameters: "0.5B",
    size_mb: 379,
    context_length: "32K",
    description: "Ultra-fast, lightweight starter model. Optimized for CPU and edge inference.",
    hf_url: "https://huggingface.co/Qwen/Qwen2-0.5B-Instruct-GGUF",
    tags: ["CPU Ready", "Starter", "Q4_K_M"],
  },
  {
    id: "prism-ml/Bonsai-1.7B-gguf",
    filename: "Bonsai-1.7B-Q1_0.gguf",
    name: "Prism ML Bonsai 1.7B",
    display_name: "Prism ML Bonsai 1.7B",
    repo_id: "prism-ml/Bonsai-1.7B-gguf",
    type: "base",
    architecture: "Bonsai (1-bit)",
    quantization: "Q1_0 (1-bit)",
    parameters: "1.7B",
    size_mb: 256,
    context_length: "32K",
    description: "Extreme low-bit 1-bit quantized SLM with a ~250 MB footprint. High speed edge execution with near zero memory overhead.",
    hf_url: "https://huggingface.co/prism-ml/Bonsai-1.7B-gguf",
    tags: ["1-bit Quantized", "Ternary", "Edge Ready", "~250 MB"],
  },
];
