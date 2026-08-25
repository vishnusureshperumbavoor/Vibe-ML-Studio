import React from "react";
import {
  Sparkles,
  Zap,
  Database,
  StopCircle,
  Box,
  BarChart2,
  Cpu,
  LayoutGrid,
  Square,
} from "lucide-react";
import { Button } from "./Button";
import { TrainingProgress } from "../hooks/useWorkflows";

export type TopLevelView =
  | "knowledge"
  | "workflow"
  | "gallery"
  | "evaluate"
  | "chat"
  | "creative"
  | "gguf"
  | "onnx"
  | "studio";

interface AppHeaderProps {
  activeView: TopLevelView;
  setActiveView: (view: TopLevelView) => void;
  isAutoRunning: boolean;
  onStopAutoPilot: () => void;
  trainingProgress?: TrainingProgress | null;
  onViewTraining?: () => void;
  onStopTraining?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeView,
  setActiveView,
  isAutoRunning,
  onStopAutoPilot,
  trainingProgress,
  onViewTraining,
  onStopTraining,
}) => {
  return (
    <header className="flex-none h-14 border-b border-[#352554] bg-[#140F1D] flex items-center px-4 justify-between z-20 sticky top-0 relative">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Sparkles className="text-white" size={18} />
        </div>
        <div>
          <span className="font-bold tracking-tight text-white block text-sm flex items-center gap-1.5">
            VML STUDIO
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-normal">
              v2.0
            </span>
          </span>
          <span className="text-[10px] text-gray-500 block leading-none">
            Local SLM Post-Training & Distillation IDE
          </span>
        </div>
      </div>

      {/* Live Training Progress Pill Badge (Visible across all tabs) */}
      {trainingProgress && (
        <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-300">
          <button
            onClick={onViewTraining}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#1C1528] border border-amber-500/30 hover:border-amber-500/70 hover:bg-[#251b36] transition-all cursor-pointer shadow-lg shadow-amber-500/10 group"
            title="Click to view Studio Notebook"
          >
            <span className="relative flex h-2 w-2">
              {trainingProgress.isCompleted ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </>
              )}
            </span>

            <span className="text-xs font-bold text-amber-300 font-mono tracking-tight flex items-center gap-1.5">
              {trainingProgress.isCompleted ? (
                <span className="text-emerald-300">✅ Training Complete (100%)</span>
              ) : (
                <>
                  <span>🚀 Training:</span>
                  <span className="text-amber-200">
                    Step {trainingProgress.currentStep}/{trainingProgress.totalSteps}
                  </span>
                  <span className="text-amber-400/80 font-bold">({trainingProgress.percentage}%)</span>
                </>
              )}
            </span>

            {trainingProgress.loss !== undefined && !trainingProgress.isCompleted && (
              <span className="text-xs text-white/50 font-mono pl-2 border-l border-[#352554]">
                Loss: <span className="text-amber-200 font-semibold">{trainingProgress.loss}</span>
              </span>
            )}

            <span className="text-[10px] text-amber-400/70 uppercase font-black tracking-wider group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all ml-1 hidden sm:inline">
              Studio →
            </span>
          </button>

          {!trainingProgress.isCompleted && onStopTraining && (
            <button
              onClick={onStopTraining}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-bold transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
              title="Stop Training Process Immediately"
            >
              <Square size={12} fill="currentColor" />
              <span>Stop</span>
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* View Switcher */}
        <div className="flex bg-[#0B090F] p-1 rounded-xl border border-[#352554] mr-2 gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("knowledge")}
            className={`gap-2 h-10 px-3.5 rounded-xl transition-all duration-300 border ${
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
            className={`gap-2 h-10 px-3.5 rounded-xl transition-all duration-300 border ${
              activeView === "workflow" || activeView === "studio"
                ? "bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "text-gray-400 border-transparent hover:bg-white/5"
            }`}
          >
            <Zap size={16} />
            <span className="text-xs font-semibold">Build</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("gallery")}
            className={`gap-2 h-10 px-3.5 rounded-xl transition-all duration-300 border ${
              activeView === "gallery"
                ? "bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "text-gray-400 border-transparent hover:bg-white/5"
            }`}
          >
            <LayoutGrid size={16} />
            <span className="text-xs font-semibold">Gallery</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("evaluate")}
            className={`gap-2 h-10 px-3.5 rounded-xl transition-all duration-300 border ${
              activeView === "evaluate"
                ? "bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "text-gray-400 border-transparent hover:bg-white/5"
            }`}
          >
            <BarChart2 size={16} />
            <span className="text-xs font-semibold">Evaluation</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("creative")}
            className={`gap-2 h-10 px-3.5 rounded-xl transition-all duration-300 border ${
              activeView === "creative"
                ? "bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                : "text-gray-400 border-transparent hover:bg-white/5"
            }`}
          >
            <Sparkles size={16} />
            <span className="text-xs font-semibold">Diffusion</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("gguf")}
            className={`gap-2 h-10 px-3.5 rounded-xl transition-all duration-300 border ${
              activeView === "gguf"
                ? "bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "text-gray-400 border-transparent hover:bg-white/5"
            }`}
          >
            <Box size={16} />
            <span className="text-xs font-semibold">GGUF</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("onnx")}
            className={`gap-2 h-10 px-3.5 rounded-xl transition-all duration-300 border ${
              activeView === "onnx"
                ? "bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "text-gray-400 border-transparent hover:bg-white/5"
            }`}
          >
            <Cpu size={16} />
            <span className="text-xs font-semibold">ONNX</span>
          </Button>
        </div>

        {isAutoRunning && (
          <>
            <div className="h-4 w-px bg-[#352554] mx-2"></div>
            <Button
              size="sm"
              variant="danger"
              onClick={onStopAutoPilot}
              className="border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40"
            >
              <StopCircle size={14} className="mr-2" />
              Stop Auto-Pilot
            </Button>
          </>
        )}
      </div>

      {/* Live Thin Neon Progress Line across Header Bottom */}
      {trainingProgress && !trainingProgress.isCompleted && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/60 overflow-hidden pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-400 transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.9)]"
            style={{ width: `${Math.max(trainingProgress.percentage, 3)}%` }}
          />
        </div>
      )}
    </header>
  );
};
