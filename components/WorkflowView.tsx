import React, { useState } from "react";
import { Copy, CheckCircle2 } from "lucide-react";
import { WorkFlowSwitcher } from "./WorkFlowSwitcher";
import { FineTuningPanel } from "./FineTuningPanel";
import { StudioView } from "./StudioView";
import { CellData, CellType } from "../types";
import { formatNotebookContext } from "../utils/notebookUtils";

interface WorkflowViewProps {
  workflowMode: "finetune" | "studio";
  setWorkflowMode: (mode: "finetune" | "studio") => void;
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
  onNavigateToChat: (model?: string) => void;

  // Studio Notebook Props
  cells: CellData[];
  activeCellId: string | null;
  isAutoRunning: boolean;
  isGenerating: boolean;
  clarification: string | null;
  activeTrainingSession: {
    modelId: string;
    datasetId: string;
    maxSteps: number;
    startTime: number;
  } | null;
  thinkingHistory: string[];
  onFocusCell: (id: string) => void;
  onChangeCell: (id: string, content: string) => void;
  onRunCell: (id: string) => void;
  onDeleteCell: (id: string) => void;
  onMoveUpCell: (id: string) => void;
  onMoveDownCell: (id: string) => void;
  onTypeChangeCell: (id: string, type: CellType) => void;
  onDismissClarification: () => void;
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
  onNavigateToChat,

  cells,
  activeCellId,
  isAutoRunning,
  isGenerating,
  clarification,
  activeTrainingSession,
  thinkingHistory,
  onFocusCell,
  onChangeCell,
  onRunCell,
  onDeleteCell,
  onMoveUpCell,
  onMoveDownCell,
  onTypeChangeCell,
  onDismissClarification,
}) => {
  const [wasCopyAllClicked, setWasCopyAllClicked] = useState(false);

  const handleCopyNotebook = () => {
    const context = formatNotebookContext(cells, thinkingHistory);
    navigator.clipboard.writeText(context);
    setWasCopyAllClicked(true);
    setTimeout(() => setWasCopyAllClicked(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0B090F] overflow-y-auto p-6 items-center space-y-8 w-full">
      <div className="w-full max-w-5xl flex items-center justify-between gap-4 shrink-0 px-2">
        <div className="w-36 hidden sm:block" />

        <WorkFlowSwitcher
          active={workflowMode}
          onChange={setWorkflowMode}
        />

        <div className="flex justify-end">
          <button
            onClick={handleCopyNotebook}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all duration-300 shadow-lg backdrop-blur-md cursor-pointer ${
              wasCopyAllClicked
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-emerald-500/10"
                : "bg-[#140F1D] border-white/10 text-white/60 hover:bg-white/5 hover:border-white/20 hover:text-white"
            }`}
            title="Copy entire notebook context & logs"
          >
            {wasCopyAllClicked ? (
              <CheckCircle2 size={14} className="text-emerald-400" />
            ) : (
              <Copy size={14} />
            )}
            <span className="text-[11px] font-bold tracking-wider uppercase">
              {wasCopyAllClicked ? "COPIED TO CLIPBOARD" : "COPY NOTEBOOK"}
            </span>
          </button>
        </div>
      </div>

      {workflowMode === "finetune" ? (
        <div className="w-full max-w-4xl bg-[#140F1D] border border-white/5 rounded-[32px] p-8 shadow-2xl relative group shrink-0">
          <div className="absolute top-0 right-0 p-12 bg-amber-500/5 blur-[120px] rounded-full group-hover:bg-amber-500/10 transition-colors duration-1000" />
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
        </div>
      ) : (
        <div className="w-full flex-1 min-h-[600px] flex flex-col bg-[#0B090F] rounded-2xl border border-white/5 overflow-hidden">
          <StudioView
            cells={cells}
            activeCellId={activeCellId}
            isAutoRunning={isAutoRunning}
            isGenerating={isGenerating}
            clarification={clarification}
            activeTrainingSession={activeTrainingSession}
            thinkingHistory={thinkingHistory}
            onFocusCell={onFocusCell}
            onChangeCell={onChangeCell}
            onRunCell={onRunCell}
            onDeleteCell={onDeleteCell}
            onMoveUpCell={onMoveUpCell}
            onMoveDownCell={onMoveDownCell}
            onTypeChangeCell={onTypeChangeCell}
            onOpenArena={onNavigateToChat}
            onDismissClarification={onDismissClarification}
          />
        </div>
      )}
    </div>
  );
};
