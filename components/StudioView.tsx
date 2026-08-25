import React, { useState, useRef, useEffect } from "react";
import {
  Rocket,
  Zap,
  Database,
  Sparkles,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { Cell } from "./Cell";
import { CellData, CellType } from "../types";
import { formatNotebookContext } from "../utils/notebookUtils";

interface StudioViewProps {
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
  onOpenArena: (modelId: string) => void;
  onDismissClarification: () => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
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
  onOpenArena,
  onDismissClarification,
}) => {
  const [wasCopyAllClicked, setWasCopyAllClicked] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cells.length > 1 && !activeCellId && isGenerating) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [cells.length, isGenerating, activeCellId]);

  const handleCopyAll = () => {
    const context = formatNotebookContext(cells, thinkingHistory);
    navigator.clipboard.writeText(context);
    setWasCopyAllClicked(true);
    setTimeout(() => setWasCopyAllClicked(false), 2000);
  };

  return (
    <>
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
                      onClick={onDismissClarification}
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

          {cells.map((cell) => (
            <React.Fragment key={cell.id}>
              <div id={`cell-${cell.id}`}>
                <Cell
                  cell={cell}
                  isActive={activeCellId === cell.id}
                  onFocus={() => onFocusCell(cell.id)}
                  onChange={onChangeCell}
                  onRun={onRunCell}
                  onDelete={onDeleteCell}
                  onMoveUp={(id) => onMoveUpCell(id)}
                  onMoveDown={(id) => onMoveDownCell(id)}
                  onTypeChange={onTypeChangeCell}
                  onOpenArena={onOpenArena}
                  metadata={cell.metadata}
                />
              </div>
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
  );
};
