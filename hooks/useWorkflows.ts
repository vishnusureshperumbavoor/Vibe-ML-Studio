import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { CellData, ExecutionMode } from "../types";
import { executeCode, fixCodeError } from "../services/aiService";
import { generateOnnxExportScript } from "../services/workflowService";
import { API_BASE } from "../constants";

import { TopLevelView } from "../components/AppHeader";

interface UseWorkflowsProps {
  setCells: React.Dispatch<React.SetStateAction<CellData[]>>;
  setActiveView: (view: TopLevelView) => void;
  setThinking: (thinking: string | null) => void;
  setThinkingHistory: React.Dispatch<React.SetStateAction<string[]>>;
  mode: ExecutionMode;
}

export function useWorkflows({
  setCells,
  setActiveView,
  setThinking,
  setThinkingHistory,
  mode,
}: UseWorkflowsProps) {
  const [workflowMode, setWorkflowMode] = useState<"finetune" | "studio">("finetune");
  const [isWorkflowExecuting, setIsWorkflowExecuting] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [workflowModelFilename, setWorkflowModelFilename] = useState<string | null>(null);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string | undefined>(undefined);
  const [activeTrainingSession, setActiveTrainingSession] = useState<{
    modelId: string;
    datasetId: string;
    maxSteps: number;
    startTime: number;
  } | null>(null);

  // SFT persistent state (Optimized for CPU & 32GB RAM)
  const [sftModelId, setSftModelId] = useState("Qwen/Qwen2-0.5B");
  const [sftDatasetId, setSftDatasetId] = useState("lavita/MedQuAD");
  const [sftHardware, setSftHardware] = useState("CPU");
  const [sftMaxSteps, setSftMaxSteps] = useState(50);
  const [sftRank, setSftRank] = useState(16);

  const handleStartDeployment = async (
    path: string,
    slug: string,
    baseModel: string = "Unknown",
    datasetId: string = "Unknown"
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
            prev.map((c) => (c.id === cellId ? { ...c, output: partial } : c))
          );
        },
        () => {}
      );

      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId
            ? {
                ...c,
                status: result.error ? "error" : "success",
                output: result.error || result.text,
              }
            : c
        )
      );

      if (result.text && result.text.includes("[VML_DEPLOYMENT_URL]")) {
        const urlMatch = result.text.match(
          /\[VML_DEPLOYMENT_URL\] (https:\/\/huggingface\.co\/[^\s]+)/
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
    rank: number
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
      const resp = await fetch("http://127.0.0.1:3001/mcp/call", {
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

      setWorkflowMode("studio");
      setActiveView("workflow");

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
        const deploymentName = modelSlug;

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
                c.id === cellId ? { ...c, output: partial } : c
              )
            );
          },
          (plotPoint) => {
            if (!plotPoint.vml_total_steps) {
              const match = blockScript.match(/max_steps=(\d+)/);
              if (match) plotPoint.vml_total_steps = parseInt(match[1]);
            }
            plotPoint.timestamp = Date.now();

            setCells((prev) =>
              prev.map((c) =>
                c.id === cellId
                  ? { ...c, plots: [...(c.plots || []), plotPoint] }
                  : c
              )
            );
          }
        );

        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? {
                  ...c,
                  status: result.error ? "error" : "success",
                  output: result.error || result.text,
                }
              : c
          )
        );

        if (result.text && result.text.includes("[VML_DEPLOYMENT_URL]")) {
          const urlMatch = result.text.match(
            /\[VML_DEPLOYMENT_URL\] (https:\/\/huggingface\.co\/[^\s]+)/
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
              `[Attempt ${attempt}/3] Analyzing error and generating autonomous fix...`
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
                  : c
              )
            );

            setThinkingHistory((prev) => [
              ...prev,
              `Fix ${attempt} generated. Executing...`,
            ]);
            setThinking(null);

            setCells((prev) =>
              prev.map((c) =>
                c.id === nextId ? { ...c, status: "running" } : c
              )
            );
            const retryResult = await executeCode(
              fixedCode,
              (partial) => {
                setCells((prev) =>
                  prev.map((c) =>
                    c.id === nextId ? { ...c, output: partial } : c
                  )
                );
              },
              (plotPoint) => {
                setCells((prev) =>
                  prev.map((c) =>
                    c.id === nextId
                      ? { ...c, plots: [...(c.plots || []), plotPoint] }
                      : c
                  )
                );
              }
            );

            setCells((prev) =>
              prev.map((c) =>
                c.id === nextId
                  ? {
                      ...c,
                      status: retryResult.error ? "error" : "success",
                      output: retryResult.error || retryResult.text,
                    }
                  : c
              )
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

          if (!recoverySuccess) break;
        } else if (result.error) {
          break;
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
      const modelNameClean = modelId.split("/").pop()?.toLowerCase();
      setWorkflowModelFilename(`${modelNameClean}-q${bits}_0.gguf`);

      const resp = await fetch("http://127.0.0.1:3001/mcp/call", {
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

      setWorkflowMode("studio");
      setActiveView("workflow");

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
                c.id === cellId ? { ...c, output: partial } : c
              )
            );
          },
          (plotPoint) => {
            setCells((prev) =>
              prev.map((c) =>
                c.id === cellId
                  ? { ...c, plots: [...(c.plots || []), plotPoint] }
                  : c
              )
            );
          }
        );

        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? {
                  ...c,
                  status: result.error ? "error" : "success",
                  output: result.error || result.text,
                }
              : c
          )
        );

        if (result.text && result.text.includes("[VML_DEPLOYMENT_URL]")) {
          const urlMatch = result.text.match(
            /\[VML_DEPLOYMENT_URL\] (https:\/\/huggingface\.co\/[^\s]+)/
          );
          if (urlMatch) setDeploymentUrl(urlMatch[1]);
        }

        if (result.error) break;
      }
    } catch (e) {
      console.error("Quantization Workflow Failed:", e);
    } finally {
      setIsWorkflowExecuting(false);
    }
  };

  const handleStartOnnx = async (adapterSlug: string, precision: string) => {
    setIsWorkflowExecuting(true);
    setWorkflowMode("studio");
    setActiveView("workflow");

    const code = generateOnnxExportScript(adapterSlug, precision);
    const cellId = uuidv4();
    const newCell: CellData = {
      id: cellId,
      type: "code",
      content: code,
      status: "running",
    };

    setCells((prev) => [...prev, newCell]);

    const result = await executeCode(
      code,
      (partial) => {
        setCells((prev) =>
          prev.map((c) => (c.id === cellId ? { ...c, output: partial } : c))
        );
      },
      (plotPoint) => {
        setCells((prev) =>
          prev.map((c) =>
            c.id === cellId
              ? { ...c, plots: [...(c.plots || []), plotPoint] }
              : c
          )
        );
      }
    );

    setCells((prev) =>
      prev.map((c) =>
        c.id === cellId
          ? {
              ...c,
              status: result.error ? "error" : "success",
              output: result.error || result.text,
            }
          : c
      )
    );

    setIsWorkflowExecuting(false);
  };

  const handleStartGeneration = async (params: {
    prompt: string;
    mode: string;
    strength: number;
    guidance_scale: number;
    base_image?: File;
  }) => {
    try {
      const formData = new FormData();
      formData.append("prompt", params.prompt);
      formData.append("strength", params.strength.toString());
      formData.append("guidance_scale", params.guidance_scale.toString());

      if (params.mode === "img2img" && params.base_image) {
        formData.append("image", params.base_image);
      }

      const endpoint =
        params.mode === "img2img" ? "/image/img2img" : "/image/generate";
      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        body: formData,
      });

      const data = await resp.json();
      if (data.filename) {
        setLastGeneratedImage(data.filename);
      }
    } catch (e) {
      console.error("Generation failed:", e);
    }
  };

  return {
    workflowMode,
    setWorkflowMode,
    isWorkflowExecuting,
    deploymentUrl,
    workflowModelFilename,
    lastGeneratedImage,
    activeTrainingSession,
    sftModelId,
    setSftModelId,
    sftDatasetId,
    setSftDatasetId,
    sftHardware,
    setSftHardware,
    sftMaxSteps,
    setSftMaxSteps,
    sftRank,
    setSftRank,
    handleStartSFT,
    handleStartQuantization,
    handleStartOnnx,
    handleStartDeployment,
    handleStartGeneration,
  };
}
