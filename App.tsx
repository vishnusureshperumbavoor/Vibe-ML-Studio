import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Sparkles,
  Send,
  StopCircle,
  Zap,
  Map,
  Rocket,
  Square,
  Activity,
  MessageSquare,
  Terminal,
  CheckCircle2,
  Copy,
  Database,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Cell } from "./components/Cell";
import { Button } from "./components/Button";
import ManageSkillsPanel from "./components/ManageSkillsPanel";
import { KnowledgeLibrary } from "./components/KnowledgeLibrary";
import {
  CellData,
  CellType,
  ExecutionMode,
  ConnectorConfig,
  SkillInfo,
  PluginDefinition,
} from "./types";
import {
  executeCode,
  fixCodeError,
  generateNotebookStructure,
} from "./services/aiService";
import { VMLAgent } from "./services/vmlAgent";
import { ThinkingView } from "./components/ThinkingView";
import { ChatView } from "./components/ChatView";
import { WorkFlowSwitcher } from "./components/WorkFlowSwitcher";
import { FineTuningPanel } from "./components/FineTuningPanel";
import { QuantizationPanel } from "./components/QuantizationPanel";

const API_BASE = "http://127.0.0.1:2000";

const INITIAL_CONNECTORS: ConnectorConfig[] = [
  {
    id: "huggingface",
    label: "Hugging Face MCP",
    description: "Local bridge for Hugging Face Hub tools (models/datasets).",
    url: "http://127.0.0.1:1001",
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

const CONNECTOR_PLUGINS: PluginDefinition[] = [
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

const INITIAL_CELLS: CellData[] = [];

export default function App() {
  const [cells, setCells] = useState<CellData[]>(INITIAL_CELLS);
  const cellsRef = useRef<CellData[]>(INITIAL_CELLS); // Ref to access latest state in async loop
  const queryHistoryRef = useRef<{ cell: CellData; index: number }[]>([]);

  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [clarification, setClarification] = useState<string | null>(null);
  const [mode, setMode] = useState<ExecutionMode>("agent");
  const [thinking, setThinking] = useState<string | null>(null);
  const [thinkingHistory, setThinkingHistory] = useState<string[]>([]);
  const [connectorSettings, setConnectorSettings] = useState<ConnectorConfig[]>(
    () => INITIAL_CONNECTORS,
  );
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [pluginStates, setPluginStates] = useState<Record<string, boolean>>(
    () =>
      CONNECTOR_PLUGINS.reduce(
        (acc, plugin) => {
          acc[plugin.id] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
  );
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [activeMenuCategory, setActiveMenuCategory] = useState<
    "skills" | "connectors"
  >("skills");
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const [showManageSkills, setShowManageSkills] = useState(false);
  const [manageTab, setManageTab] = useState<"skills" | "connectors">("skills");
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(
    null,
  );
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashHighlight, setSlashHighlight] = useState(0);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<
    "studio" | "chat" | "workflow" | "knowledge"
  >("knowledge");
  const [workflowMode, setWorkflowMode] = useState<"quantize" | "finetune">(
    "finetune",
  );
  const [isWorkflowExecuting, setIsWorkflowExecuting] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [workflowModelFilename, setWorkflowModelFilename] = useState<
    string | null
  >(null);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [chatSelectedModel, setChatSelectedModel] = useState<string>("");
  const [preSelectedDataset, setPreSelectedDataset] = useState<string | null>(
    null,
  );
  const [wasCopyAllClicked, setWasCopyAllClicked] = useState(false);
  const stopExecutionRef = useRef(false);
  const stopAgentRef = useRef(false);
  const [activeTrainingSession, setActiveTrainingSession] = useState<{
    modelId: string;
    datasetId: string;
    maxSteps: number;
    startTime: number;
  } | null>(null);

  // SFT persistent state
  const [sftModelId, setSftModelId] = useState("");
  const [sftDatasetId, setSftDatasetId] = useState("");
  const [sftHardware, setSftHardware] = useState("CPU");
  const [sftMaxSteps, setSftMaxSteps] = useState(5);
  const [sftRank, setSftRank] = useState(16);
  
  // Distillation State (Persistent across tab switches)
  const [distillStatus, setDistillStatus] = useState({ step: 'idle', progress: 0, current_task: '' });
  const [showDistillUI, setShowDistillUI] = useState(false);

  useEffect(() => {
    // Poll distillation status globally if it's active
    let interval: any;
    if (distillStatus.step !== 'idle' && distillStatus.step !== 'complete' && distillStatus.step !== 'error') {
      interval = setInterval(async () => {
        try {
          const resp = await fetch("http://127.0.0.1:2000/distill/status");
          const status = await resp.json();
          setDistillStatus(status);
          if (status.step !== 'idle') setShowDistillUI(true);
          
          if (status.step === 'complete') {
            const filename = status.current_task.split('Dataset ready: ')[1] || 
                             status.current_task.split('Mission Accomplished! Published to: ')[1]?.split('/').pop() + '.jsonl';
            
            if (filename) {
               setPreSelectedDataset(filename);
            }
          }
        } catch (e) {
          console.error("Global status poll failed", e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [distillStatus.step]);

  const handleCopyAll = () => {
    let context = "# VML STUDIO WORKFLOW REPORT\n\n";

    if (thinkingHistory.length > 0) {
      context += "## AGENT REASONING LOG\n";
      thinkingHistory.forEach((t, i) => {
        context += `${i + 1}. ${t}\n`;
      });
      context += "\n---\n\n";
    }

    cells.forEach((cell, index) => {
      context += `## CELL ${index + 1} (${cell.type.toUpperCase()})\n`;
      context += `**Status**: ${cell.status}\n\n`;
      context += `### CONTENT\n\`\`\`${cell.type === "code" ? "python" : "markdown"}\n${cell.content}\n\`\`\`\n\n`;
      if (cell.output) {
        context += `### OUTPUT\n\`\`\`text\n${cell.output}\n\`\`\`\n\n`;
      }
      context += "---\n\n";
    });

    navigator.clipboard.writeText(context);
    setWasCopyAllClicked(true);
    setTimeout(() => setWasCopyAllClicked(false), 2000);
  };

  const handleOpenArena = async (modelId: string) => {
    setChatSelectedModel(modelId);
    setActiveView("chat");
  };

  const fetchSystemInfo = async () => {
    try {
      const resp = await fetch("http://127.0.0.1:1001/mcp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "get_system_specs", arguments: {} }),
      });
      const data = await resp.json();
      const text = data[0]?.text || "";
      if (text.includes("[JSON_RESULTS]")) {
        const jsonStr = text.split("[JSON_RESULTS]")[1].trim();
        setSystemInfo(JSON.parse(jsonStr));
      }
    } catch (e) {
      console.error("Failed to fetch system info:", e);
    }
  };

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const handleStartDeployment = async (
    path: string,
    slug: string,
    baseModel: string = "Unknown",
    datasetId: string = "Unknown",
  ) => {
    try {
      const cellId = uuidv4();
      const code = `import sys
import os
sys.path.append(os.path.join(os.getcwd(), "server"))
from hf_uploader import upload_to_hf
upload_to_hf(r"${path}", "${slug}", "${baseModel}", "${datasetId}")`;

      setCells((prev) => [
        ...prev,
        {
          id: cellId,
          type: "code",
          content: code,
          status: "running",
        },
      ]);

      const result = await executeCode(
        code,
        (partial) => {
          setCells((prev) =>
            prev.map((c) => (c.id === cellId ? { ...c, output: partial } : c)),
          );
        },
        () => {},
      );

      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId
            ? {
                ...c,
                status: result.error ? "error" : "success",
                output: result.error || result.text,
              }
            : c,
        ),
      );

      if (result.text && result.text.includes("[VML_DEPLOYMENT_URL]")) {
        const urlMatch = result.text.match(
          /\[VML_DEPLOYMENT_URL\] (https:\/\/huggingface\.co\/[^\s]+)/,
        );
        if (urlMatch) setDeploymentUrl(urlMatch[1]);
      }
    } catch (e) {
      console.error("Auto-Deployment Failed:", e);
    }
  };

  const handleStartSFT = async (
    modelId: string,
    datasetId: string,
    hardware: string,
    maxSteps: number,
    rank: number,
  ) => {
    setIsWorkflowExecuting(true);
    setDeploymentUrl(null);
    setWorkflowModelFilename(null);
    setActiveTrainingSession({
      modelId,
      datasetId,
      maxSteps,
      startTime: Date.now(),
    });
    try {
      // 1. Call MCP to get script
      const resp = await fetch("http://127.0.0.1:1001/mcp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "start_sft_job",
          arguments: {
            base_model: modelId,
            dataset_id: datasetId,
            hardware_target: hardware,
            max_steps: maxSteps,
            rank: rank,
          },
        }),
      });
      const data = await resp.json();
      const rawText = data.result?.[0]?.text || "";

      let blocks = [rawText];
      if (rawText.startsWith("[VML_BLOCKS]")) {
        const jsonStr = rawText.replace("[VML_BLOCKS]", "").trim();
        blocks = JSON.parse(jsonStr);
      }

      setActiveView("studio");

      // 2. Add and Execute Cells Sequentially
      for (const blockScript of blocks) {
        const cellId = uuidv4();
        const modelPart =
          modelId
            .split("/")
            .pop()
            ?.toLowerCase()
            .replace(/\./g, "-")
            .replace(/_/g, "-") || "model";
        const datasetPart =
          datasetId
            .split("/")
            .pop()
            ?.split("_")
            .slice(0, 2)
            .join("-")
            .toLowerCase()
            .replace(/\./g, "-") || "dataset";
        const modelSlug = `${modelPart}-${datasetPart}-vml1`;
        const deploymentName = modelSlug; // Keep them consistent for simplicity and clarity

        const newCell: CellData = {
          id: cellId,
          type: "code",
          content: blockScript,
          status: "running",
          plots: [],
          metadata: {
            model_name: deploymentName,
            model_slug: modelSlug,
          },
        };

        setCells((prev) => [...prev, newCell]);

        const result = await executeCode(
          blockScript,
          (partial) => {
            setCells((prev) =>
              prev.map((c) =>
                c.id === cellId ? { ...c, output: partial } : c,
              ),
            );
          },
          (plotPoint) => {
            // Heuristic: If missing total steps, try to find in script
            if (!plotPoint.vml_total_steps) {
              const match = blockScript.match(/max_steps=(\d+)/);
              if (match) plotPoint.vml_total_steps = parseInt(match[1]);
            }
            // Add arrival timestamp for live runtime calculation
            plotPoint.timestamp = Date.now();

            setCells((prev) =>
              prev.map((c) =>
                c.id === cellId
                  ? { ...c, plots: [...(c.plots || []), plotPoint] }
                  : c,
              ),
            );
          },
        );

        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? {
                  ...c,
                  status: result.error ? "error" : "success",
                  output: result.error || result.text,
                }
              : c,
          ),
        );

        // ORCHESTRATION: Detect Agentic Handoff Signals
        if (result.text && result.text.includes("[VML_HANDOFF]")) {
          try {
            // Extract JSON from signal
            const jsonStr = result.text
              .split("[VML_HANDOFF]")[1]
              .trim()
              .split("\n")[0];
            const handoff = JSON.parse(jsonStr);

            if (handoff.vml_type === "HANDOFF_SFT_COMPLETE") {
              console.log(
                "🚀 VML Orchestrator: SFT Complete. Automated parallel tasks (Deployment/Quantization) are currently DISABLED for testing.",
              );
              /* 
                // 1. Trigger Async Deployment (Parallel) with README metadata
                handleStartDeployment(handoff.adapter_dir, handoff.model_slug, handoff.base_model, handoff.dataset_id);
                
                // 2. Trigger Sequential Quantization
                setTimeout(() => {
                  handleStartQuantization(handoff.base_model, "4"); 
                }, 1000);
                */
            }
          } catch (e) {
            console.error("Orchestration signal parsing failed:", e);
          }
        }

        // Parse deployment URL if success signal is present (legacy support for single scripts)
        if (result.text && result.text.includes("[VML_DEPLOYMENT_URL]")) {
          const urlMatch = result.text.match(
            /\[VML_DEPLOYMENT_URL\] (https:\/\/huggingface\.co\/[^\s]+)/,
          );
          if (urlMatch) setDeploymentUrl(urlMatch[1]);
        }

        if (result.error && mode === "agent") {
          let currentError = result.text || result.error;
          let currentCode = blockScript;
          let recoverySuccess = false;

          for (let attempt = 1; attempt <= 3; attempt++) {
            const nextId = uuidv4();
            const nextCell: CellData = {
              id: nextId,
              type: "code",
              content: `// VML Agent Recovery Attempt ${attempt}/3...`,
              status: "running",
            };
            setCells((prev) => [...prev, nextCell]);

            setThinking(
              `[Attempt ${attempt}/3] Analyzing error and generating autonomous fix...`,
            );
            setThinkingHistory((prev) => [
              ...prev,
              `Recovery Attempt ${attempt}: Analyzing latest error trace...`,
            ]);

            const fixedCode = await fixCodeError(currentCode, currentError);
            setCells((prev) =>
              prev.map((c) =>
                c.id === nextId
                  ? { ...c, content: fixedCode, status: "success" }
                  : c,
              ),
            );

            setThinkingHistory((prev) => [
              ...prev,
              `Fix ${attempt} generated. Executing...`,
            ]);
            setThinking(null);

            // Execute the fixed chunk
            setCells((prev) =>
              prev.map((c) =>
                c.id === nextId ? { ...c, status: "running" } : c,
              ),
            );
            const retryResult = await executeCode(
              fixedCode,
              (partial) => {
                setCells((prev) =>
                  prev.map((c) =>
                    c.id === nextId ? { ...c, output: partial } : c,
                  ),
                );
              },
              (plotPoint) => {
                setCells((prev) =>
                  prev.map((c) =>
                    c.id === nextId
                      ? { ...c, plots: [...(c.plots || []), plotPoint] }
                      : c,
                  ),
                );
              },
            );

            setCells((prev) =>
              prev.map((c) =>
                c.id === nextId
                  ? {
                      ...c,
                      status: retryResult.error ? "error" : "success",
                      output: retryResult.error || retryResult.text,
                    }
                  : c,
              ),
            );

            if (!retryResult.error) {
              recoverySuccess = true;
              break;
            } else {
              currentError = retryResult.error || retryResult.text;
              currentCode = fixedCode;
              setThinkingHistory((prev) => [
                ...prev,
                `Attempt ${attempt} failed. Re-evaluating...`,
              ]);
            }
          }

          if (!recoverySuccess) break; // Break the whole sequence if we couldn't fix this block after 3 tries
        } else if (result.error) {
          break; // Manual mode, just stop
        }
      }
    } catch (e) {
      console.error("SFT Failed:", e);
    } finally {
      setIsWorkflowExecuting(false);
    }
  };

  const handleStartQuantization = async (modelId: string, bits: string) => {
    setIsWorkflowExecuting(true);
    setDeploymentUrl(null);
    setWorkflowModelFilename(null);
    try {
      // For Arena redirect: predict filename
      const modelNameClean = modelId.split("/").pop()?.toLowerCase();
      setWorkflowModelFilename(`${modelNameClean}-q${bits}_0.gguf`);

      const resp = await fetch("http://127.0.0.1:1001/mcp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "start_quantization_job",
          arguments: { model_id: modelId, bits: bits },
        }),
      });
      const data = await resp.json();
      const rawText = data.result?.[0]?.text || data[0]?.text || "";

      if (!rawText) {
        const errorMsg = data.error || data.message || "Unknown Error";
        const details = JSON.stringify(data, null, 2);
        setCells((prev) => [
          ...prev,
          {
            id: uuidv4(),
            type: "markdown",
            content: `### ❌ Quantization Tool Error\n**Response**: ${errorMsg}\n\n**Details**:\n\`\`\`json\n${details}\n\`\`\``,
            status: "error",
          },
        ]);
        return;
      }

      let blocks = [rawText];
      if (rawText.startsWith("[VML_BLOCKS]")) {
        try {
          const jsonStr = rawText.replace("[VML_BLOCKS]", "").trim();
          blocks = JSON.parse(jsonStr);
        } catch (e) {
          console.error("Failed to parse quantization blocks:", e);
        }
      }

      setActiveView("studio");

      // Add and Execute Cells Sequentially
      for (const blockScript of blocks) {
        const cellId = uuidv4();
        const newCell: CellData = {
          id: cellId,
          type: "code",
          content: blockScript,
          status: "running",
        };

        setCells((prev) => [...prev, newCell]);

        const result = await executeCode(
          blockScript,
          (partial) => {
            setCells((prev) =>
              prev.map((c) =>
                c.id === cellId ? { ...c, output: partial } : c,
              ),
            );
          },
          (plotPoint) => {
            setCells((prev) =>
              prev.map((c) =>
                c.id === cellId
                  ? { ...c, plots: [...(c.plots || []), plotPoint] }
                  : c,
              ),
            );
          },
        );

        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? {
                  ...c,
                  status: result.error ? "error" : "success",
                  output: result.error || result.text,
                }
              : c,
          ),
        );

        // Parse deployment URL
        if (result.text && result.text.includes("[VML_DEPLOYMENT_URL]")) {
          const urlMatch = result.text.match(
            /\[VML_DEPLOYMENT_URL\] (https:\/\/huggingface\.co\/[^\s]+)/,
          );
          if (urlMatch) setDeploymentUrl(urlMatch[1]);
        }

        if (result.error) break; // Stop the sequence if a block fails
      }
    } catch (e) {
      console.error("Quantization Workflow Failed:", e);
    } finally {
      setIsWorkflowExecuting(false);
    }
  };

  const handleToggleConnector = (id: string) => {
    setConnectorSettings((prev) =>
      prev.map((connector) =>
        connector.id === id
          ? { ...connector, enabled: !connector.enabled }
          : connector,
      ),
    );
  };

  const handleUpdateConnectorUrl = (id: string, url: string) => {
    setConnectorSettings((prev) =>
      prev.map((connector) =>
        connector.id === id
          ? { ...connector, url, status: "idle", statusMessage: "" }
          : connector,
      ),
    );
  };

  const handleTestConnector = async (id: string) => {
    setConnectorSettings((prev) =>
      prev.map((connector) =>
        connector.id === id
          ? { ...connector, status: "testing", statusMessage: "Checking…" }
          : connector,
      ),
    );
    const target = connectorSettings.find((connector) => connector.id === id);
    if (!target) return;
    if (!target.url) {
      setConnectorSettings((prev) =>
        prev.map((connector) =>
          connector.id === id
            ? {
                ...connector,
                status: "error",
                statusMessage: "URL is not set",
                lastChecked: new Date().toLocaleTimeString(),
              }
            : connector,
        ),
      );
      return;
    }

    try {
      const cleanUrl = target.url.replace(/\/+$/, "");
      const resp = await fetch(`${cleanUrl}/mcp/list`);
      if (!resp.ok) {
        throw new Error(`Status ${resp.status}`);
      }
      const data = await resp.json();
      setConnectorSettings((prev) =>
        prev.map((connector) =>
          connector.id === id
            ? {
                ...connector,
                status: "healthy",
                statusMessage: `${data.tools?.length ?? 0} tools`,
                lastChecked: new Date().toLocaleTimeString(),
              }
            : connector,
        ),
      );
    } catch (error: any) {
      setConnectorSettings((prev) =>
        prev.map((connector) =>
          connector.id === id
            ? {
                ...connector,
                status: "error",
                statusMessage: error?.message ?? "Connection failed",
                lastChecked: new Date().toLocaleTimeString(),
              }
            : connector,
        ),
      );
    }
  };

  const handleToggleSkillAutoActivate = (name: string) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.name === name
          ? { ...skill, autoActivate: !skill.autoActivate }
          : skill,
      ),
    );
  };

  const handleViewSkillInstructions = async (name: string) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.name === name
          ? { ...skill, showInstructions: !skill.showInstructions }
          : skill,
      ),
    );

    const skill = skills.find((item) => item.name === name);
    if (!skill || skill.instructions || skill.loadingInstructions) return;

    setSkills((prev) =>
      prev.map((item) =>
        item.name === name ? { ...item, loadingInstructions: true } : item,
      ),
    );

    try {
      const resp = await fetch(`${API_BASE}/read_file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: `skills/${name}/SKILLS.md` }),
      });
      const data = await resp.json();
      const instructions = data.content || "";
      const summaryLine = instructions.split("\n")[0]?.trim() || "";
      setSkills((prev) =>
        prev.map((item) =>
          item.name === name
            ? {
                ...item,
                instructions,
                summary: item.summary || summaryLine,
                loadingInstructions: false,
              }
            : item,
        ),
      );
    } catch (error: any) {
      setSkills((prev) =>
        prev.map((item) =>
          item.name === name
            ? {
                ...item,
                instructions: `Unable to load instructions: ${
                  error?.message ?? "Unknown error"
                }`,
                loadingInstructions: false,
              }
            : item,
        ),
      );
    }
  };

  const handleSelectSkill = (name: string) => {
    setSelectedSkillName(name);
  };

  const openManagePanel = (tab: "skills" | "connectors" = "skills") => {
    setManageTab(tab);
    setShowManageSkills(true);
    setIsPlusMenuOpen(false);
    setSlashMenuOpen(false);
    setSlashFilter("");
    if (tab === "skills" && skills.length) {
      if (!selectedSkillName) {
        setSelectedSkillName(skills[0].name);
      }
    }
  };

  const handleSlashSelection = (skillName: string) => {
    setPrompt(`/${skillName} `);
    setSlashMenuOpen(false);
    setSlashFilter("");
    setSlashHighlight(0);
  };

  const handleTogglePlugin = (pluginId: string) => {
    const plugin = CONNECTOR_PLUGINS.find((p) => p.id === pluginId);
    if (!plugin) return;
    setPluginStates((prev) => {
      const nextState = !prev[pluginId];
      setConnectorSettings((prevConnectors) =>
        prevConnectors.map((connector) =>
          plugin.connectors.includes(connector.id)
            ? { ...connector, enabled: nextState }
            : connector,
        ),
      );
      setSkills((prevSkills) =>
        prevSkills.map((skill) =>
          plugin.skills.includes(skill.name)
            ? { ...skill, autoActivate: nextState }
            : skill,
        ),
      );
      return { ...prev, [pluginId]: nextState };
    });
  };

  const syncQueryIndexes = (cells: CellData[]) => {
    const updated = queryHistoryRef.current
      .map((entry) => {
        const newIndex = cells.findIndex((cell) => cell.id === entry.cell.id);
        if (newIndex === -1) return null;
        return { ...entry, index: newIndex };
      })
      .filter(
        (entry): entry is { cell: CellData; index: number } => entry !== null,
      );
    const seen = new Set<string>();
    queryHistoryRef.current = updated.filter((entry) => {
      if (seen.has(entry.cell.id)) return false;
      seen.add(entry.cell.id);
      return true;
    });
  };

  const recordQueryCell = (cell: CellData, index: number) => {
    queryHistoryRef.current = queryHistoryRef.current.filter(
      (entry) => entry.cell.id !== cell.id,
    );
    queryHistoryRef.current.push({ cell, index });
  };

  const reconcileQueryCells = (candidateCells: CellData[]) => {
    const merged = [...candidateCells];
    const missingHistory = queryHistoryRef.current.filter(
      (entry) => !merged.some((cell) => cell.id === entry.cell.id),
    );

    missingHistory.forEach((entry) => {
      const insertIndex = Math.max(0, Math.min(entry.index, merged.length));
      merged.splice(insertIndex, 0, entry.cell);
    });

    const deduped = [];
    const seen = new Set<string>();
    merged.forEach((cell) => {
      if (seen.has(cell.id)) return;
      seen.add(cell.id);
      deduped.push(cell);
    });

    syncQueryIndexes(deduped);
    return deduped;
  };

  // Sync ref with state
  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    let cancelled = false;
    const loadSkills = async () => {
      try {
        const response = await fetch(`${API_BASE}/list_skills`);
        if (!response.ok) throw new Error("Failed to fetch skills");
        const data = await response.json();
        const names = Array.isArray(data.skills) ? data.skills : [];
        if (!cancelled) {
          setSkills(
            names.map((name) => ({
              name,
              summary: "",
              autoActivate: true,
              instructions: "",
              showInstructions: false,
              loadingInstructions: false,
            })),
          );
        }
      } catch (error) {
        console.error("Unable to load skills list", error);
      }
    };
    loadSkills();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSkillName && skills.length > 0) {
      setSelectedSkillName(skills[0].name);
    }
  }, [skills, selectedSkillName]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        isPlusMenuOpen &&
        plusMenuRef.current &&
        !plusMenuRef.current.contains(target)
      ) {
        setIsPlusMenuOpen(false);
      }
      if (
        slashMenuOpen &&
        slashMenuRef.current &&
        !slashMenuRef.current.contains(target)
      ) {
        setSlashMenuOpen(false);
        setSlashFilter("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isPlusMenuOpen, slashMenuOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPlusMenuOpen(false);
        setShowManageSkills(false);
        setSlashMenuOpen(false);
        setSlashFilter("");
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Auto-scroll to bottom when new cells are added
  useEffect(() => {
    if (cells.length > 1 && !activeCellId && isGenerating) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [cells.length, isGenerating, activeCellId]);

  const handleCellFocus = (id: string) => {
    setActiveCellId(id);
  };

  const addCell = (type: CellType, index?: number) => {
    const newCell: CellData = {
      id: uuidv4(),
      type,
      content: "",
      status: "idle",
    };

    setCells((prev) => {
      const newCells = [...prev];
      const insertAt = index !== undefined ? index : prev.length;
      newCells.splice(insertAt, 0, newCell);
      return newCells;
    });
    setActiveCellId(newCell.id);
  };

  const updateCellContent = (id: string, content: string) => {
    setCells((prev) => prev.map((c) => (c.id === id ? { ...c, content } : c)));
  };

  const updateCellType = (id: string, type: CellType) => {
    setCells((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, type, output: undefined, status: "idle" } : c,
      ),
    );
  };

  const deleteCell = (id: string) => {
    if (activeCellId === id) setActiveCellId(null);
    setCells((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      cellsRef.current = updated;
      queryHistoryRef.current = queryHistoryRef.current.filter(
        (entry) => entry.cell.id !== id,
      );
      syncQueryIndexes(updated);
      return updated;
    });
  };

  const clearAll = () => {
    setCells([]);
    setHistory([]);
    setClarification(null);
    setThinking(null);
    stopExecutionRef.current = true;
    setIsAutoRunning(false);
    queryHistoryRef.current = [];
  };

  const moveCell = (id: string, direction: "up" | "down") => {
    const index = cells.findIndex((c) => c.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === cells.length - 1) return;

    const newCells = [...cells];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newCells[index], newCells[targetIndex]] = [
      newCells[targetIndex],
      newCells[index],
    ];
    setCells(newCells);
  };

  /**
   * Executes a single cell.
   * Returns a promise that resolves to the success status.
   */
  const executeSingleCell = async (
    id: string,
  ): Promise<{ success: boolean; output: string }> => {
    // Optimistic update
    setCells((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "running", output: undefined } : c,
      ),
    );

    // Get current content from ref to ensure freshness
    const cell = cellsRef.current.find((c) => c.id === id);
    if (!cell) return { success: false, output: "Cell not found" };

    // Update output live
    const localResult = await executeCode(
      cell.content,
      (partial) => {
        setCells((prev) =>
          prev.map((c) => (c.id === id ? { ...c, output: partial } : c)),
        );
      },
      (plotPoint) => {
        // Heuristic: If missing total steps, try to find in script
        if (!plotPoint.vml_total_steps) {
          const match = cell.content.match(/max_steps=(\d+)/);
          if (match) plotPoint.vml_total_steps = parseInt(match[1]);
        }
        // Add arrival timestamp for live runtime calculation
        plotPoint.timestamp = Date.now();

        setCells((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, plots: [...(c.plots || []), plotPoint] } : c,
          ),
        );
      },
    );

    setCells((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: localResult.error ? "error" : "success",
              output: localResult.error || localResult.text,
              executionCount: (c.executionCount || 0) + 1,
              lastRun: Date.now(),
            }
          : c,
      ),
    );

    return {
      success: !localResult.error,
      output: localResult.error || localResult.text,
    };
  };

  // Wrapper for manual single cell run
  const handleManualRun = async (id: string) => {
    await executeSingleCell(id);
  };

  const handleStop = () => {
    stopExecutionRef.current = true;
    stopAgentRef.current = true;
    setIsAutoRunning(false);
    setIsGenerating(false);
    setThinking(null);
  };

  const handleSubmitPrompt = async () => {
    if (isGenerating) {
      handleStop();
      return;
    }
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setThinking("Analysing your request and preparing a plan...");
    setClarification(null);
    stopAgentRef.current = false;

    const userPrompt = prompt;
    setPrompt("");

    // **Append the user query as a standard cell so they flow sequentially**
    const queryCell: CellData = {
      id: uuidv4(),
      type: "query",
      content: userPrompt,
      status: "success",
    };

    setCells((prev) => {
      const updated = [...prev, queryCell];
      cellsRef.current = updated;
      recordQueryCell(queryCell, updated.length - 1);
      syncQueryIndexes(updated);
      return updated;
    });

    if (mode === "agent") {
      setThinkingHistory([]); // Reset history for new session
      const agent = new VMLAgent(
        cellsRef.current,
        (text) => {
          setThinking(text);
          setThinkingHistory((prev) => [...prev, text]);
        },
        (updatedCells) => {
          const mergedCells = reconcileQueryCells(updatedCells);
          setCells(mergedCells);
          cellsRef.current = mergedCells;
        },
        connectorSettings,
        () => stopAgentRef.current,
      );

      if (history.length > 0) {
        agent.setHistory(history);
      }

      try {
        await agent.init();
        await agent.process(userPrompt);
        setHistory(agent.getHistory());
      } catch (error: any) {
        setCells((prev) => [
          ...prev,
          {
            id: uuidv4(),
            type: "markdown",
            content: `**Agent Error:** ${error.message}`,
            status: "error",
          },
        ]);
      } finally {
        setIsGenerating(false);
        setIsAutoRunning(false);
      }
      return;
    }

    // Default 'plan' mode remains as legacy logic
    const result = await generateNotebookStructure(prompt, mode);

    if (result.clarification) {
      // Handle clarification
      setClarification(result.clarification);
      setIsGenerating(false);
      return;
    }

    if (result.cells && result.cells.length > 0) {
      const newCells: CellData[] = result.cells.map((c) => ({
        id: uuidv4(),
        type: c.type,
        content: c.content,
        status: "idle",
      }));

      // Update state with new cells
      setCells((prev) => {
        const updated = [...prev, ...newCells];
        cellsRef.current = updated;
        syncQueryIndexes(updated);
        return updated;
      });

      setPrompt("");
    } else {
      if (result.error) {
        setCells((prev) => [
          ...prev,
          {
            id: uuidv4(),
            type: "markdown",
            content: `**Error generating plan:** ${result.error}`,
            status: "error",
          },
        ]);
      }
    }
    setIsGenerating(false);
  };

  const handlePromptChange = (next: string) => {
    setPrompt(next);
    if (!slashMenuOpen) return;
    const lastSlash = next.lastIndexOf("/");
    if (lastSlash === -1) {
      setSlashMenuOpen(false);
      setSlashFilter("");
      return;
    }
    setSlashFilter(next.slice(lastSlash + 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashMenuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashHighlight((prev) =>
          Math.min(prev + 1, Math.max(0, slashSkillOptions.length - 1)),
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashHighlight((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        if (slashSkillOptions.length) {
          e.preventDefault();
          handleSlashSelection(slashSkillOptions[slashHighlight].name);
        }
        return;
      }
      if (e.key === "Escape") {
        setSlashMenuOpen(false);
        setSlashFilter("");
        return;
      }
    }

    if (e.key === "/" && !slashMenuOpen && !isGenerating && !isAutoRunning) {
      setSlashMenuOpen(true);
      setIsPlusMenuOpen(false);
      setSlashHighlight(0);
      setSlashFilter("");
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitPrompt();
    }
  };

  const skillPreview = skills.slice(0, 3);
  const connectorPreview = connectorSettings.slice(0, 3);
  const slashSkillOptions = useMemo(() => {
    const term = slashFilter.trim().toLowerCase();
    return skills.filter((skill) => skill.name.toLowerCase().includes(term));
  }, [skills, slashFilter]);

  useEffect(() => {
    if (!slashMenuOpen) return;
    setSlashHighlight(0);
  }, [slashMenuOpen]);

  useEffect(() => {
    if (slashSkillOptions.length === 0) {
      setSlashHighlight(0);
      return;
    }
    setSlashHighlight((prev) => Math.min(prev, slashSkillOptions.length - 1));
  }, [slashSkillOptions.length]);

  return (
    <div className="flex flex-col h-screen bg-[#0B090F] text-[#E2D8F0] font-sans selection:bg-purple-500/30">
      <ThinkingView
        content={thinking}
        isVisible={!!thinking}
        history={thinkingHistory}
        onClose={() => setThinking(null)}
      />

      {/* Top Header - Minimalist */}
      <header className="flex-none h-14 border-b border-[#352554] bg-[#140F1D] flex items-center px-4 justify-between z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-lg transition-all duration-500 ${isAutoRunning ? "bg-gradient-to-br from-green-400 to-emerald-600 shadow-emerald-900/20" : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-purple-900/20"}`}
          >
            {isAutoRunning ? (
              <Zap size={16} className="animate-pulse" />
            ) : (
              <Sparkles size={16} />
            )}
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#E2D8F0] tracking-wide">
              Vibe ML Agent Studio
            </h1>
            <span className="text-xs text-[#9480B3] flex items-center gap-2">
              {isAutoRunning ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Auto-Pilot Active
                </span>
              ) : (
                "Your Personal AI R&D Agents"
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Switcher */}
          <div className="flex bg-[#0B090F] p-1 rounded-xl border border-[#352554] mr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("knowledge")}
              className={`gap-2 h-10 px-4 rounded-xl transition-all duration-300 border ${
                activeView === "knowledge"
                  ? "bg-indigo-500/20 text-indigo-200 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                  : "text-gray-400 border-transparent hover:bg-white/5"
              }`}
            >
              <Database size={16} />
              <span className="text-xs font-semibold">Knowledge</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("workflow")}
              className={`gap-2 h-10 px-4 rounded-xl transition-all duration-300 border ${
                activeView === "workflow"
                  ? "bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                  : "text-gray-400 border-transparent hover:bg-white/5"
              }`}
            >
              <Activity size={16} />
              <span className="text-xs font-semibold">Build</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("studio")}
              className={`gap-2 h-10 px-4 rounded-xl transition-all duration-300 border ${
                activeView === "studio"
                  ? "bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                  : "text-gray-400 border-transparent hover:bg-white/5"
              }`}
            >
              <Terminal size={16} />
              <span className="text-xs font-semibold">Studio</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("chat")}
              className={`gap-2 h-10 px-4 rounded-xl transition-all duration-300 border ${
                activeView === "chat"
                  ? "bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                  : "text-gray-400 border-transparent hover:bg-white/5"
              }`}
            >
              <MessageSquare size={16} />
              <span className="text-xs font-semibold">Arena</span>
            </Button>
          </div>

          {isAutoRunning && (
            <>
              <div className="h-4 w-px bg-[#352554] mx-2"></div>
              <Button
                size="sm"
                variant="danger"
                onClick={handleStop}
                className="border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40"
              >
                <StopCircle size={14} className="mr-2" />
                Stop Auto-Pilot
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative w-full">
        {activeView === "chat" ? (
          <ChatView
            selectedModel={chatSelectedModel}
            onModelChange={setChatSelectedModel}
          />
        ) : activeView === "knowledge" ? (
          <KnowledgeLibrary
            onDistillComplete={(id) => {
              setPreSelectedDataset(id);
              setActiveView("workflow");
            }}
            distillStatus={distillStatus}
            setDistillStatus={setDistillStatus}
            showDistillUI={showDistillUI}
            setShowDistillUI={setShowDistillUI}
          />
        ) : activeView === "workflow" ? (
          <div className="flex-1 flex flex-col bg-[#0B090F] overflow-y-auto p-8 items-center space-y-12">
            <div className="text-center space-y-4 max-w-2xl">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
                Model Production Center
              </h2>
              <p className="text-sm text-white/40">Create your Expert LLMs.</p>
            </div>

            {/* <WorkFlowSwitcher
              active={workflowMode}
              onChange={setWorkflowMode}
            /> */}

            <div className="w-full max-w-4xl bg-[#140F1D] border border-white/5 rounded-[32px] p-8 shadow-2xl relative group">
              <div className="absolute top-0 right-0 p-12 bg-amber-500/5 blur-[120px] rounded-full group-hover:bg-amber-500/10 transition-colors duration-1000" />

              {/* {workflowMode === "finetune" ? ( */}
              <FineTuningPanel
                onStart={handleStartSFT}
                isExecuting={isWorkflowExecuting}
                systemInfo={systemInfo}
                preSelectedDataset={preSelectedDataset}
                onClearSelection={() => setPreSelectedDataset(null)}
                deploymentUrl={deploymentUrl}
                onTestInArena={() => {
                  setActiveView("chat");
                }}
                modelId={sftModelId}
                setModelId={setSftModelId}
                datasetId={sftDatasetId}
                setDatasetId={setSftDatasetId}
                hardware={sftHardware}
                setHardware={setSftHardware}
                maxSteps={sftMaxSteps}
                setMaxSteps={setSftMaxSteps}
                rank={sftRank}
                setRank={setSftRank}
              />
              {/* ) : (
                <QuantizationPanel
                  onStart={handleStartQuantization}
                  isExecuting={isWorkflowExecuting}
                  deploymentUrl={deploymentUrl}
                  onTestInArena={(filename) => {
                    setChatSelectedModel(filename || workflowModelFilename);
                    setActiveView("chat");
                  }}
                />
              )} */}
            </div>
          </div>
        ) : (
          <>
            {/* Notebook Area */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden pb-40 px-4 md:px-8 transition-all duration-500">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="sticky top-0 z-30 flex justify-end pb-4 -mx-4 px-4 md:-mx-8 md:px-8 bg-gradient-to-b from-[#0B090F] via-[#0B090F] to-transparent pt-4 -mt-4 pointer-events-none">
                  <button
                    onClick={handleCopyAll}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all duration-300 pointer-events-auto shadow-2xl backdrop-blur-md ${
                      wasCopyAllClicked
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10"
                        : "bg-[#140F1D]/80 border-white/10 text-white/40 hover:bg-[#140F1D] hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {wasCopyAllClicked ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                    <span className="text-[10px] font-black tracking-widest uppercase">
                      {wasCopyAllClicked
                        ? "COPIED TO CLIPBOARD"
                        : "COPY NOTEBOOK CONTEXT"}
                    </span>
                  </button>
                </div>
                {/* Active Training Session Header */}
                {activeTrainingSession && (
                  <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="bg-[#140F1D] border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-12 bg-amber-500/[0.03] blur-[60px] rounded-full group-hover:bg-amber-500/[0.06] transition-colors" />

                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center relative">
                          <Rocket
                            size={20}
                            className="text-amber-500 animate-bounce"
                          />
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#140F1D] animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">
                              Active Training Base Model
                            </span>
                          </div>
                          <h3 className="text-xl font-black text-white tracking-tight">
                            {activeTrainingSession.modelId.split("/").pop()}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 pr-4">
                        <div className="flex flex-col border-l border-white/5 pl-8">
                          <span className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1">
                            Knowledge Source
                          </span>
                          <span className="text-xs font-black text-white/70 flex items-center gap-2">
                            <Database size={10} className="text-purple-500" />
                            {activeTrainingSession.datasetId.split("/").pop()}
                          </span>
                        </div>
                        <div className="flex flex-col border-l border-white/5 pl-8">
                          <span className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1">
                            Training Target
                          </span>
                          <span className="text-xs font-black text-white/70 flex items-center gap-2 uppercase tracking-widest">
                            <Zap size={10} className="text-amber-500" />
                            {activeTrainingSession.maxSteps} Steps
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Clarification Loop UI */}
                {clarification && (
                  <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <Sparkles className="text-indigo-400" size={20} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-indigo-300 font-semibold mb-2">
                          Agent Clarification Needed
                        </h3>
                        <p className="text-[#E2D8F0]/80 text-sm leading-relaxed mb-4">
                          {clarification}
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setPrompt("");
                              setClarification(null);
                            }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {cells.length === 0 && !isGenerating && !clarification && (
                  <div className="flex flex-col items-center justify-center h-64 text-[#9480B3]">
                    <Sparkles size={48} className="mb-4 text-[#352554]" />
                    <p>
                      Ladies and Gentlemen, you are not ready for the Vibe
                      Traning Agents.
                    </p>
                  </div>
                )}

                {/* Initial Cell Inserter (if empty) 
                {cells.length > 0 && (
                  <div className="group relative flex justify-center h-4 mb-[-8px] z-10">
                    <div className="absolute inset-0 flex items-center px-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
                    </div>
                    <div className="hidden group-hover:flex items-center gap-2 z-20">
                      <button
                        onClick={() => addCell("code", 0)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#140F1D] border border-purple-500/30 rounded-full text-[10px] font-bold text-purple-400 hover:bg-purple-600/20 transition-all shadow-lg"
                      >
                        <Plus size={10} /> CODE
                      </button>
                      <button
                        onClick={() => addCell("markdown", 0)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#140F1D] border border-indigo-500/30 rounded-full text-[10px] font-bold text-indigo-400 hover:bg-indigo-600/20 transition-all shadow-lg"
                      >
                        <Plus size={10} /> TEXT
                      </button>
                    </div>
                  </div>
                )} */}

                {cells.map((cell, idx) => (
                  <React.Fragment key={cell.id}>
                    <div id={`cell-${cell.id}`}>
                      <Cell
                        cell={cell}
                        isActive={activeCellId === cell.id}
                        onFocus={() => handleCellFocus(cell.id)}
                        onChange={updateCellContent}
                        onRun={handleManualRun}
                        onDelete={deleteCell}
                        onMoveUp={(id) => moveCell(id, "up")}
                        onMoveDown={(id) => moveCell(id, "down")}
                        onTypeChange={updateCellType}
                        onOpenArena={handleOpenArena}
                        metadata={cell.metadata}
                      />
                    </div>

                    {/* Intermediate Inserter 
                    <div className="group relative flex justify-center h-4 my-[-8px] z-10">
                      <div className="absolute inset-0 flex items-center px-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
                      </div>
                      <div className="hidden group-hover:flex items-center gap-2 z-20 pointer-events-auto">
                        <button
                          onClick={() => addCell("code", idx + 1)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-[#140F1D] border border-purple-500/30 rounded-full text-[10px] font-bold text-purple-400 hover:bg-purple-500/40 transition-all shadow-xl"
                        >
                          <Plus size={10} /> CODE
                        </button>
                        <button
                          onClick={() => addCell("markdown", idx + 1)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-[#140F1D] border border-indigo-500/30 rounded-full text-[10px] font-bold text-indigo-400 hover:bg-indigo-500/40 transition-all shadow-xl"
                        >
                          <Plus size={10} /> TEXT
                        </button>
                      </div>
                    </div> */}
                  </React.Fragment>
                ))}

                {/* Bottom Appender */}
                <div ref={bottomRef} className="h-4" />

                {!isAutoRunning && cells.length > 0 && (
                  <div className="group flex justify-center items-center py-8 opacity-20 hover:opacity-100 transition-opacity">
                    <div className="h-px bg-[#352554] flex-grow"></div>
                  </div>
                )}
              </div>
            </main>
            {/* Footer Gradient Overlays */}
            <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-[#0B090F] to-transparent pointer-events-none z-10"></div>
            <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#0B090F] to-transparent pointer-events-none z-10"></div>
          </>
        )}
      </div>
      {/* Bottom Prompt Bar - Floating 
      {activeView === "studio" && (
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0B090F] via-[#0B090F] to-transparent z-20 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <div
              className={`relative bg-[#1D152A] border transition-colors duration-300 rounded-xl shadow-lg overflow-visible flex flex-col ${isGenerating || isAutoRunning ? "border-purple-500 shadow-purple-500/20" : "border-[#352554] hover:border-gray-500"}`}
            >
              <div className="flex items-end p-2 gap-2">
                <div className="relative" ref={plusMenuRef}>
                  <button
                    onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                    disabled={isGenerating || isAutoRunning}
                    className={`mb-2 h-9 w-9 flex items-center justify-center rounded-full border transition ${
                      isPlusMenuOpen
                        ? "border-purple-400 text-purple-200"
                        : "border-white/20 text-slate-300 hover:border-purple-500 hover:text-purple-200"
                    } bg-[#140A1C]`}
                  >
                    <Plus size={18} />
                  </button>

                  {isPlusMenuOpen && (
                    <div className="absolute bottom-full left-0 z-30 w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#08050D] shadow-2xl">
                      <div className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
                        <div className="flex items-center justify-between">
                          <span>Quick actions</span>
                          <span className="text-[10px] text-purple-300">
                            {activeMenuCategory === "skills"
                              ? "Skills"
                              : "Connectors"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-3 border-t border-white/5 px-4 pb-4 pt-2">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => setActiveMenuCategory("skills")}
                            className={`rounded-2xl px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                              activeMenuCategory === "skills"
                                ? "border border-purple-400/60 bg-purple-500/10 text-white"
                                : "border border-white/10 text-slate-300 hover:border-white/40"
                            }`}
                          >
                            Skills
                          </button>
                          <button
                            onClick={() => setActiveMenuCategory("connectors")}
                            className={`rounded-2xl px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                              activeMenuCategory === "connectors"
                                ? "border border-purple-400/60 bg-purple-500/10 text-white"
                                : "border border-white/10 text-slate-300 hover:border-white/40"
                            }`}
                          >
                            Connectors
                          </button>
                        </div>
                        <div className="flex-1 space-y-2">
                          {activeMenuCategory === "skills" ? (
                            skillPreview.length ? (
                              skillPreview.map((skill) => (
                                <div
                                  key={skill.name}
                                  className="rounded-2xl border border-white/5 bg-[#0F0B16]/90 p-3 text-xs text-slate-200"
                                  onClick={() => handleSelectSkill(skill.name)}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-white">
                                        {skill.name}
                                      </p>
                                      <p className="text-[11px] text-slate-400">
                                        {skill.summary || "Personal skill"}
                                      </p>
                                    </div>
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleToggleSkillAutoActivate(
                                          skill.name,
                                        );
                                      }}
                                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase transition ${
                                        skill.autoActivate
                                          ? "border-emerald-400 text-emerald-300"
                                          : "border-white/20 text-white/70"
                                      }`}
                                    >
                                      Auto {skill.autoActivate ? "On" : "Off"}
                                    </button>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between text-[10px]">
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleToggleSkillAutoActivate(skill.name);
                                      }}
                                      className="text-slate-300 hover:text-white"
                                    >
                                      {skill.showInstructions
                                        ? "Hide"
                                        : "View instructions"}
                                    </button>
                                    <span className="text-[10px] text-slate-500">
                                      SKILLS.md
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-slate-400">
                                No skills loaded yet.
                              </p>
                            )
                          ) : connectorPreview.length ? (
                            connectorPreview.map((connector) => (
                              <div
                                key={connector.id}
                                className="rounded-2xl border border-white/5 bg-[#0F0B16]/90 p-3 text-xs text-slate-200"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">
                                      {connector.label}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      {connector.description}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleToggleConnector(connector.id)
                                    }
                                    className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase transition ${
                                      connector.enabled
                                        ? "border-emerald-400 text-emerald-300"
                                        : "border-white/20 text-white/70"
                                    }`}
                                  >
                                    {connector.enabled ? "On" : "Off"}
                                  </button>
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                                  <span className="font-semibold text-slate-200">
                                    {connector.status || "Idle"}
                                  </span>
                                  <span>{connector.statusMessage}</span>
                                </div>
                                <button
                                  onClick={() =>
                                    handleTestConnector(connector.id)
                                  }
                                  className="mt-2 rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-300 transition hover:border-white/40 hover:text-white"
                                >
                                  Test
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-slate-400">
                              No connectors configured.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-white/5 px-4 py-3">
                        <button
                          onClick={() => openManagePanel("skills")}
                          className="w-full rounded-2xl border border-white/10 bg-purple-600/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:border-purple-400/80 hover:bg-purple-500/20"
                        >
                          Manage skills & connectors
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {slashMenuOpen && (
                  <div
                    ref={slashMenuRef}
                    className="absolute left-4 bottom-full mb-3 z-40 w-[320px] rounded-2xl border border-white/10 bg-[#09040F] shadow-2xl"
                  >
                    <div className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
                      Slash commands
                    </div>
                    <div className="max-h-56 overflow-y-auto px-2 pb-2 text-sm text-slate-200">
                      {slashSkillOptions.length ? (
                        slashSkillOptions.map((skill, index) => (
                          <button
                            key={skill.name}
                            onClick={() => handleSlashSelection(skill.name)}
                            onMouseEnter={() => setSlashHighlight(index)}
                            className={`w-full rounded-xl px-3 py-2 text-left transition ${
                              index === slashHighlight
                                ? "bg-purple-500/20 text-white"
                                : "text-slate-200 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[13px]">
                              <span>{skill.name}</span>
                              <span className="text-[10px] uppercase text-slate-400">
                                Skill
                              </span>
                            </div>
                            <p className="text-[12px] text-slate-400">
                              {skill.summary || "Personal skill"}
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          Type to filter skills…
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <button
                  onClick={() =>
                    setMode((prev) => (prev === "agent" ? "plan" : "agent"))
                  }
                  disabled={isGenerating || isAutoRunning}
                  className={`mb-2 ml-2 p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-medium border
                            ${
                              mode === "agent"
                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20"
                                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                            }
                        `}
                >
                  {mode === "agent" ? (
                    <>
                      <Rocket size={14} />
                      <span className="hidden sm:inline">Agent</span>
                    </>
                  ) : (
                    <>
                      <Map size={14} />
                      <span className="hidden sm:inline">Plan</span>
                    </>
                  )}
                </button>

                <textarea
                  value={prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isGenerating || isAutoRunning
                      ? "VML Agent is running..."
                      : mode === "agent"
                        ? "How can VML Agent help you today?"
                        : "How can VML Planner help you today?"
                  }
                  className="flex-1 bg-transparent text-white placeholder-gray-500 text-base p-3 focus:outline-none resize-none max-h-40"
                  rows={1}
                  style={{ minHeight: "50px" }}
                  disabled={isGenerating || isAutoRunning}
                />

                <button
                  onClick={isGenerating ? handleStop : handleSubmitPrompt}
                  disabled={(!prompt.trim() && !isGenerating) || isAutoRunning}
                  className={`mb-2 mr-2 p-2 rounded-lg transition-all ${
                    (prompt.trim() || isGenerating) && !isAutoRunning
                      ? "bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                      : "bg-[#1a1a1a] text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isGenerating ? (
                    <Square size={18} fill="currentColor" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>

              {(isGenerating || isAutoRunning) && (
                <div className="absolute bottom-2 left-4 right-4 h-0.5 bg-white/5 overflow-hidden rounded-full pointer-events-none">
                  <div
                    className={`h-full ${isGenerating ? "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"} animate-progress-indeterminate`}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )} */}
      <ManageSkillsPanel
        visible={showManageSkills}
        onClose={() => setShowManageSkills(false)}
        activeTab={manageTab}
        onChangeTab={(tab) => setManageTab(tab)}
        skills={skills}
        connectors={connectorSettings}
        pluginDefinitions={CONNECTOR_PLUGINS}
        pluginStates={pluginStates}
        selectedSkillName={selectedSkillName}
        onSelectSkill={handleSelectSkill}
        onToggleSkillAutoActivate={handleToggleSkillAutoActivate}
        onViewSkillInstructions={handleViewSkillInstructions}
        onToggleConnector={handleToggleConnector}
        onUpdateConnectorUrl={handleUpdateConnectorUrl}
        onTestConnector={handleTestConnector}
        onTogglePlugin={handleTogglePlugin}
      />
    </div>
  );
}
