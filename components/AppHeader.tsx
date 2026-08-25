import React from "react";
import {
  Sparkles,
  Zap,
  Activity,
  MessageSquare,
  Terminal,
  Database,
  StopCircle,
} from "lucide-react";
import { Button } from "./Button";

interface AppHeaderProps {
  activeView: "studio" | "chat" | "workflow" | "knowledge" | "creative";
  setActiveView: (
    view: "studio" | "chat" | "workflow" | "knowledge" | "creative"
  ) => void;
  isAutoRunning: boolean;
  onStopAutoPilot: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeView,
  setActiveView,
  isAutoRunning,
  onStopAutoPilot,
}) => {
  return (
    <header className="flex-none h-14 border-b border-[#352554] bg-[#140F1D] flex items-center px-4 justify-between z-10 sticky top-0">
      <div className="flex items-center gap-3">
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-lg transition-all duration-500 ${
            isAutoRunning
              ? "bg-gradient-to-br from-green-400 to-emerald-600 shadow-emerald-900/20"
              : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-purple-900/20"
          }`}
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("creative")}
            className={`gap-2 h-10 px-4 rounded-xl transition-all duration-300 border ${
              activeView === "creative"
                ? "bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                : "text-gray-400 border-transparent hover:bg-white/5"
            }`}
          >
            <Sparkles size={16} />
            <span className="text-xs font-semibold">Image</span>
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
    </header>
  );
};
