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
