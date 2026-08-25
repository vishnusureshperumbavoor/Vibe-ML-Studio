import React from "react";
import { WorkFlowSwitcher } from "./WorkFlowSwitcher";
import { FineTuningPanel } from "./FineTuningPanel";
import { QuantizationPanel } from "./QuantizationPanel";
import { OnnxPanel } from "./OnnxPanel";
import { VisionPanel } from "./VisionPanel";
import { BenchmarkPanel } from "./BenchmarkPanel";

interface WorkflowViewProps {
  workflowMode: "quantize" | "finetune" | "evaluate" | "onnx" | "vision";
  setWorkflowMode: (
    mode: "quantize" | "finetune" | "evaluate" | "onnx" | "vision"
  ) => void;
  isWorkflowExecuting: boolean;
  systemInfo: any;
  preSelectedDataset: string | null;
  onClearSelection: () => void;
  deploymentUrl: string | null;
  workflowModelFilename: string | null;
  sftModelId: string;
  setSftModelId: (val: string) => void;
  sftDatasetId: string;
  setSftDatasetId: (val: string) => void;
  sftHardware: string;
  setSftHardware: (val: string) => void;
  sftMaxSteps: number;
  setSftMaxSteps: (val: number) => void;
  sftRank: number;
  setSftRank: (val: number) => void;
  onStartSFT: (
    modelId: string,
    datasetId: string,
    hardware: string,
    maxSteps: number,
    rank: number
  ) => void;
  onStartQuantization: (modelId: string, bits: string) => void;
  onStartOnnx: (adapterSlug: string, precision: string) => void;
  onNavigateToChat: (model?: string) => void;
  onNavigateToCreative: () => void;
}

export const WorkflowView: React.FC<WorkflowViewProps> = ({
  workflowMode,
  setWorkflowMode,
  isWorkflowExecuting,
  systemInfo,
  preSelectedDataset,
  onClearSelection,
  deploymentUrl,
  workflowModelFilename,
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
  onStartSFT,
  onStartQuantization,
  onStartOnnx,
  onNavigateToChat,
  onNavigateToCreative,
}) => {
  return (
    <div className="flex-1 flex flex-col bg-[#0B090F] overflow-y-auto p-8 items-center space-y-10">
      <div className="text-center space-y-3 max-w-2xl shrink-0">
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
          Model Production Center
        </h2>
        <p className="text-sm text-white/40">Create your Expert LLMs.</p>
      </div>

      <WorkFlowSwitcher
        active={workflowMode}
        onChange={setWorkflowMode}
      />

      <div className="w-full max-w-4xl bg-[#140F1D] border border-white/5 rounded-[32px] p-8 shadow-2xl relative group shrink-0">
        <div className="absolute top-0 right-0 p-12 bg-amber-500/5 blur-[120px] rounded-full group-hover:bg-amber-500/10 transition-colors duration-1000" />

        {workflowMode === "finetune" ? (
          <FineTuningPanel
            onStart={onStartSFT}
            isExecuting={isWorkflowExecuting}
            systemInfo={systemInfo}
            preSelectedDataset={preSelectedDataset}
            onClearSelection={onClearSelection}
            deploymentUrl={deploymentUrl}
            onTestInArena={() => onNavigateToChat()}
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
        ) : workflowMode === "quantize" ? (
          <QuantizationPanel
            onStart={onStartQuantization}
            isExecuting={isWorkflowExecuting}
            deploymentUrl={deploymentUrl}
            onTestInArena={(filename) => {
              onNavigateToChat(filename || workflowModelFilename || undefined);
            }}
          />
        ) : workflowMode === "onnx" ? (
          <OnnxPanel
            onStart={onStartOnnx}
            isExecuting={isWorkflowExecuting}
          />
        ) : workflowMode === "vision" ? (
          <VisionPanel
            onNavigateToCreative={onNavigateToCreative}
          />
        ) : (
          <BenchmarkPanel systemInfo={systemInfo} />
        )}
      </div>
    </div>
  );
};
