import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Zap,
  Box,
  Cpu,
  MessageSquare,
  Search,
  ArrowLeft,
  HardDrive,
  CheckCircle2,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { ChatView } from "./ChatView";

export interface GalleryModelItem {
  name: string;
  display_name?: string;
  source: string;
  type: "base" | "adapter" | "onnx";
  lora_slug?: string;
  onnx_slug?: string;
  base_model?: string;
  lora_rank?: number;
  dataset_id?: string;
  size_mb?: number;
  created_at?: number;
  quantization?: string;
  parameters?: string;
  architecture?: string;
  description?: string;
}

interface ModelGalleryProps {
  initialSelectedModel?: string;
  onNavigateToBuild?: () => void;
}

export const ModelGallery: React.FC<ModelGalleryProps> = ({
  initialSelectedModel,
  onNavigateToBuild,
}) => {
  const [models, setModels] = useState<GalleryModelItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "adapter" | "base" | "onnx">("all");
  const [activeChatModel, setActiveChatModel] = useState<string | null>(initialSelectedModel || null);

  // Model Deletion State
  const [modelToDelete, setModelToDelete] = useState<GalleryModelItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedModel) {
      setActiveChatModel(initialSelectedModel);
    }
  }, [initialSelectedModel]);

  const fetchModels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:2000/list_native_models");
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      }
    } catch (e) {
      console.error("Failed fetching gallery models:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteModel = async () => {
    if (!modelToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("http://127.0.0.1:2000/delete_model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: modelToDelete.name,
          type: modelToDelete.type,
          lora_slug: modelToDelete.lora_slug,
          onnx_slug: modelToDelete.onnx_slug,
        }),
      });

      if (res.ok) {
        setModelToDelete(null);
        await fetchModels();
      } else {
        const data = await res.json();
        setDeleteError(data.detail || "Failed to delete model.");
      }
    } catch (e: any) {
      setDeleteError(e.message || "Failed to communicate with server.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const filteredModels = models.filter((m) => {
    const matchesFilter = activeFilter === "all" || m.type === activeFilter;
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      m.name.toLowerCase().includes(query) ||
      (m.display_name && m.display_name.toLowerCase().includes(query)) ||
      (m.dataset_id && m.dataset_id.toLowerCase().includes(query)) ||
      (m.architecture && m.architecture.toLowerCase().includes(query)) ||
      (m.base_model && m.base_model.toLowerCase().includes(query));
    return matchesFilter && matchesQuery;
  });

  const formatSize = (mb?: number) => {
    if (mb === undefined || mb === null || mb <= 0) return "0.00 MB";
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const totalSizeMb = models.reduce((acc, m) => acc + (m.size_mb || 0), 0);
  const totalAdapters = models.filter((m) => m.type === "adapter").length;
  const totalBaseGgufs = models.filter((m) => m.type === "base").length;

  // If a model is active for chat, render the integrated Arena Chat UI with top breadcrumb
  if (activeChatModel) {
    const currentModelObj = models.find((m) => m.name === activeChatModel);
    return (
      <div className="flex-1 flex flex-col h-full bg-[#0B090F] overflow-hidden animate-in fade-in duration-300">
        {/* Gallery Chat Breadcrumb Header */}
        <div className="h-12 border-b border-[#352554] bg-[#140F1D] px-6 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveChatModel(null)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              <span>Back to Gallery</span>
            </button>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-white/50">Model:</span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {currentModelObj?.display_name || activeChatModel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active Session
            </span>
          </div>
        </div>

        {/* Embedded Chat View with active model pre-selected */}
        <div className="flex-1 overflow-hidden">
          <ChatView
            selectedModel={activeChatModel}
            onModelChange={(newModel) => setActiveChatModel(newModel)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B090F] overflow-y-auto">
      {/* Top Banner / Header */}
      <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/5">
                <Sparkles className="text-amber-400" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Model Gallery & Weight Manager
                </h1>
                <p className="text-xs text-white/50 font-medium">
                  Explore fine-tuned LoRA adapters, local base GGUFs, and in-browser ONNX models.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchModels}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Refresh models list"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            {onNavigateToBuild && (
              <button
                onClick={onNavigateToBuild}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Zap size={14} />
                <span>Fine-Tune New Model</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#140F1D] border border-white/5 space-y-1">
            <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider">
              Total Models
            </span>
            <div className="text-2xl font-black text-white font-mono">{models.length}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#140F1D] border border-white/5 space-y-1">
            <span className="text-[11px] text-amber-400/80 font-bold uppercase tracking-wider">
              Fine-Tuned LoRA
            </span>
            <div className="text-2xl font-black text-amber-400 font-mono">{totalAdapters}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#140F1D] border border-white/5 space-y-1">
            <span className="text-[11px] text-purple-400/80 font-bold uppercase tracking-wider">
              Base GGUF
            </span>
            <div className="text-2xl font-black text-purple-400 font-mono">{totalBaseGgufs}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#140F1D] border border-white/5 space-y-1">
            <span className="text-[11px] text-emerald-400/80 font-bold uppercase tracking-wider">
              Disk Footprint
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {formatSize(totalSizeMb)}
            </div>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#140F1D] p-3 rounded-2xl border border-white/5">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-white text-black shadow-lg"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              All Models ({models.length})
            </button>
            <button
              onClick={() => setActiveFilter("adapter")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "adapter"
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Zap size={12} />
              <span>Fine-Tuned ({totalAdapters})</span>
            </button>
            <button
              onClick={() => setActiveFilter("base")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "base"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Box size={12} />
              <span>Base GGUF ({totalBaseGgufs})</span>
            </button>
            <button
              onClick={() => setActiveFilter("onnx")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "onnx"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Cpu size={12} />
              <span>ONNX Web ({models.filter((m) => m.type === "onnx").length})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search local models..."
              className="w-full bg-[#0B090F] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-all"
            />
          </div>
        </div>

        {/* Model Cards Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40 space-y-3">
            <RefreshCw size={24} className="animate-spin text-amber-400" />
            <span className="text-xs font-bold">Scanning local models...</span>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 rounded-3xl bg-[#140F1D]/50 border border-white/5 p-8">
            <Box size={40} className="text-white/20" />
            <div>
              <h3 className="text-sm font-bold text-white">No models found</h3>
              <p className="text-xs text-white/40 mt-1 max-w-sm">
                {searchQuery
                  ? "No models match your search query. Try clearing the filter."
                  : "No models available in this category. Train an SLM in the Build tab to get started!"}
              </p>
            </div>
            {onNavigateToBuild && (
              <button
                onClick={onNavigateToBuild}
                className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition-all cursor-pointer"
              >
                Go to Build Tab
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModels.map((model, idx) => {
              const isLoRA = model.type === "adapter";
              const isBase = model.type === "base";

              return (
                <div
                  key={idx}
                  onClick={() => setActiveChatModel(model.name)}
                  className={`group rounded-3xl bg-[#140F1D] border transition-all duration-300 p-5 pt-4 flex flex-col justify-between space-y-4 relative overflow-hidden shadow-xl hover:shadow-2xl cursor-pointer ${
                    isLoRA
                      ? "border-amber-500/20 hover:border-amber-500/50 hover:shadow-amber-500/5"
                      : isBase
                      ? "border-purple-500/20 hover:border-purple-500/50 hover:shadow-purple-500/5"
                      : "border-indigo-500/20 hover:border-indigo-500/50 hover:shadow-indigo-500/5"
                  }`}
                >
                  {/* Subtle Background Glow */}
                  <div
                    className={`absolute top-0 right-0 p-16 blur-[80px] rounded-full pointer-events-none transition-all duration-500 ${
                      isLoRA
                        ? "bg-amber-500/5 group-hover:bg-amber-500/10"
                        : isBase
                        ? "bg-purple-500/5 group-hover:bg-purple-500/10"
                        : "bg-indigo-500/5 group-hover:bg-indigo-500/10"
                    }`}
                  />

                  {/* Card Header */}
                  <div className="space-y-2.5 relative z-10">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                          isLoRA
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                            : isBase
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                            : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                        }`}
                      >
                        {isLoRA ? (
                          <>
                            <Zap size={11} />
                            <span>Fine-Tuned LoRA</span>
                          </>
                        ) : isBase ? (
                          <>
                            <Box size={11} />
                            <span>Base GGUF</span>
                          </>
                        ) : (
                          <>
                            <Cpu size={11} />
                            <span>ONNX Web</span>
                          </>
                        )}
                      </span>

                      <div className="flex items-center gap-2">
                        {model.size_mb !== undefined && (
                          <span className="text-[11px] font-mono text-white/50 flex items-center gap-1">
                            <HardDrive size={11} />
                            <span>{formatSize(model.size_mb)}</span>
                          </span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModelToDelete(model);
                            setDeleteError(null);
                          }}
                          className="p-1.5 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                          title="Delete Model"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight group-hover:text-amber-200 transition-colors line-clamp-1">
                        {model.display_name || model.name}
                      </h3>
                      <p className="text-xs text-white/40 mt-1 line-clamp-2 leading-relaxed">
                        {model.description ||
                          (isLoRA
                            ? `Specialized domain model fine-tuned on ${model.dataset_id || "custom data"}.`
                            : "High performance quantized base model for instant local chat.")}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Spec Pills */}
                  <div className="space-y-4 relative z-10 pt-2 border-t border-white/5">
                    <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                      {model.base_model && (
                        <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-white/70">
                          Base: <span className="text-white font-semibold">{model.base_model.split("/").pop()}</span>
                        </div>
                      )}
                      {model.lora_rank && (
                        <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                          Rank: <span className="font-semibold">{model.lora_rank}</span>
                        </div>
                      )}
                      {model.quantization && (
                        <div className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">
                          Quant: <span className="font-semibold">{model.quantization}</span>
                        </div>
                      )}
                      {model.parameters && (
                        <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-white/70">
                          Params: <span className="text-white font-semibold">{model.parameters}</span>
                        </div>
                      )}
                      {model.dataset_id && (
                        <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 truncate max-w-[200px]">
                          Dataset: <span className="font-semibold">{model.dataset_id.split("/").pop()}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Footer */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] text-white/30 flex items-center gap-1 font-mono">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span>Ready to Chat</span>
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveChatModel(model.name);
                        }}
                        className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                          isLoRA
                            ? "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-900/30 group-hover:scale-105"
                            : isBase
                            ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30 group-hover:scale-105"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/30 group-hover:scale-105"
                        }`}
                      >
                        <MessageSquare size={13} />
                        <span>Chat Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {modelToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#140F1D] border border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Model</h3>
                <p className="text-xs text-white/40">This action permanently deletes model weights.</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed bg-[#0B090F] p-4 rounded-2xl border border-white/5 font-mono">
              Are you sure you want to delete <strong className="text-white">{modelToDelete.display_name || modelToDelete.name}</strong>?
              {modelToDelete.size_mb !== undefined && (
                <span className="block mt-1 text-white/40">
                  This will free {formatSize(modelToDelete.size_mb)} of disk space.
                </span>
              )}
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setModelToDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteModel}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-900/30 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? "Deleting..." : "Delete Model"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
