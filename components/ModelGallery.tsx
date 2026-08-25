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
  Download,
  Loader2,
  ExternalLink,
  Cloud,
  UploadCloud,
  Globe,
  Lock,
  Check,
  Copy,
} from "lucide-react";
import { ChatView } from "./ChatView";
import { HUB_RECOMMENDED_MODELS } from "../constants";

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
  is_downloaded?: boolean;
  repo_id?: string;
  filename?: string;
  hf_url?: string;
  tags?: string[];
}

interface ModelGalleryProps {
  initialSelectedModel?: string;
  onNavigateToBuild?: () => void;
}

export const ModelGallery: React.FC<ModelGalleryProps> = ({
  initialSelectedModel,
  onNavigateToBuild,
}) => {
  const [localModels, setLocalModels] = useState<GalleryModelItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "adapter" | "base" | "onnx" | "hub">("all");
  const [activeChatModel, setActiveChatModel] = useState<string | null>(initialSelectedModel || null);

  // Model Download States
  const [downloadStates, setDownloadStates] = useState<{
    [filename: string]: { status: string; progress: number; message: string };
  }>({});

  // Model Deletion State
  const [modelToDelete, setModelToDelete] = useState<GalleryModelItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Hugging Face Upload State
  const [modelToUpload, setModelToUpload] = useState<GalleryModelItem | null>(null);
  const [hfUsername, setHfUsername] = useState<string>("");
  const [isHfAuthenticated, setIsHfAuthenticated] = useState<boolean | null>(null);
  const [hfAuthError, setHfAuthError] = useState<string | null>(null);
  const [customRepoName, setCustomRepoName] = useState<string>("");
  const [isPrivateRepo, setIsPrivateRepo] = useState<boolean>(false);
  const [createSpace, setCreateSpace] = useState<boolean>(true);
  const [isUploadingHf, setIsUploadingHf] = useState<boolean>(false);
  const [hfUploadError, setHfUploadError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [hfUploadSuccess, setHfUploadSuccess] = useState<{
    repo_id: string;
    url: string;
    space_url?: string;
  } | null>(null);

  useEffect(() => {
    if (initialSelectedModel) {
      setActiveChatModel(initialSelectedModel);
    }
  }, [initialSelectedModel]);

  const checkHfAuth = async () => {
    try {
      const res = await fetch("http://127.0.0.1:2000/hf/auth_status");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setIsHfAuthenticated(true);
          setHfUsername(data.username || "user");
          setHfAuthError(null);
        } else {
          setIsHfAuthenticated(false);
          setHfAuthError(data.error || "HF_TOKEN not found in .env");
        }
      }
    } catch (e: any) {
      setIsHfAuthenticated(false);
      setHfAuthError(e.message || "Failed to reach server");
    }
  };

  const handleOpenUploadModal = (model: GalleryModelItem) => {
    setModelToUpload(model);
    setCustomRepoName(model.lora_slug || model.name.replace(/[^a-zA-Z0-9-_]/g, "-"));
    setHfUploadError(null);
    setHfUploadSuccess(null);
    setIsUploadingHf(false);
    checkHfAuth();
  };

  const handlePushToHf = async () => {
    if (!modelToUpload || !modelToUpload.lora_slug) return;
    setIsUploadingHf(true);
    setHfUploadError(null);

    try {
      const res = await fetch("http://127.0.0.1:2000/models/upload_to_hf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lora_slug: modelToUpload.lora_slug,
          repo_name: customRepoName.trim() || modelToUpload.lora_slug,
          is_private: isPrivateRepo,
          create_space: createSpace,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.error || "Upload failed");
      }

      setHfUploadSuccess({
        repo_id: data.repo_id,
        url: data.url,
        space_url: data.space_url,
      });

      // Refresh models list to populate new hf_url
      await fetchModels();
    } catch (e: any) {
      setHfUploadError(e.message || "Failed to push model to Hugging Face.");
    } finally {
      setIsUploadingHf(false);
    }
  };

  const fetchModels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:2000/list_native_models");
      if (res.ok) {
        const data = await res.json();
        setLocalModels(data.models || []);
      }
    } catch (e) {
      console.error("Failed fetching gallery models:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadModel = async (repo_id: string, filename: string) => {
    setDownloadStates((prev) => ({
      ...prev,
      [filename]: { status: "downloading", progress: 5, message: "Initiating download..." },
    }));

    try {
      const formData = new FormData();
      formData.append("repo_id", repo_id);
      formData.append("filename", filename);

      const res = await fetch("http://127.0.0.1:2000/models/download_gguf", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to start download");
      }

      // Poll status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `http://127.0.0.1:2000/models/gguf_status?filename=${encodeURIComponent(filename)}`
          );
          if (statusRes.ok) {
            const data = await statusRes.json();
            if (data.is_present || data.status === "ready") {
              clearInterval(pollInterval);
              setDownloadStates((prev) => ({
                ...prev,
                [filename]: { status: "ready", progress: 100, message: "Download Complete!" },
              }));
              await fetchModels();
            } else if (data.status === "error") {
              clearInterval(pollInterval);
              setDownloadStates((prev) => ({
                ...prev,
                [filename]: { status: "error", progress: 0, message: data.message || "Download Failed." },
              }));
            } else if (data.status === "downloading") {
              setDownloadStates((prev) => ({
                ...prev,
                [filename]: {
                  status: "downloading",
                  progress: data.progress || 0,
                  message: data.message || "Downloading...",
                },
              }));
            }
          }
        } catch (pollErr) {
          console.error("Error polling download status:", pollErr);
        }
      }, 1500);
    } catch (e: any) {
      setDownloadStates((prev) => ({
        ...prev,
        [filename]: { status: "error", progress: 0, message: e.message || "Failed to trigger download." },
      }));
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

  // Build unified cards (local models + recommended hub models)
  const allCards: GalleryModelItem[] = [
    // 1. Local Models
    ...localModels.map((m) => {
      const matchingRec = HUB_RECOMMENDED_MODELS.find(
        (rec) =>
          m.name.toLowerCase() === rec.filename.toLowerCase() ||
          m.name.toLowerCase().includes(rec.filename.toLowerCase().replace(".gguf", ""))
      );
      return {
        ...m,
        is_downloaded: true,
        hf_url: matchingRec?.hf_url,
        tags: matchingRec?.tags,
      };
    }),
    // 2. Recommended Hub Models that are not downloaded locally yet
    ...HUB_RECOMMENDED_MODELS.filter((rec) => {
      return !localModels.some(
        (m) =>
          m.name.toLowerCase() === rec.filename.toLowerCase() ||
          m.name.toLowerCase().includes(rec.filename.toLowerCase().replace(".gguf", ""))
      );
    }).map((rec) => ({
      name: rec.filename,
      display_name: rec.display_name,
      source: "hub",
      type: "base" as const,
      size_mb: rec.size_mb,
      quantization: rec.quantization,
      parameters: rec.parameters,
      architecture: rec.architecture,
      description: rec.description,
      is_downloaded: false,
      repo_id: rec.repo_id,
      filename: rec.filename,
      hf_url: rec.hf_url,
      tags: rec.tags,
    })),
  ];

  const filteredModels = allCards.filter((m) => {
    let matchesFilter = true;
    if (activeFilter === "adapter") matchesFilter = m.type === "adapter";
    else if (activeFilter === "base") matchesFilter = m.type === "base" && m.is_downloaded;
    else if (activeFilter === "onnx") matchesFilter = m.type === "onnx";
    else if (activeFilter === "hub") matchesFilter = !m.is_downloaded;

    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      m.name.toLowerCase().includes(query) ||
      (m.display_name && m.display_name.toLowerCase().includes(query)) ||
      (m.dataset_id && m.dataset_id.toLowerCase().includes(query)) ||
      (m.architecture && m.architecture.toLowerCase().includes(query)) ||
      (m.base_model && m.base_model.toLowerCase().includes(query)) ||
      (m.tags && m.tags.some((t) => t.toLowerCase().includes(query)));
    return matchesFilter && matchesQuery;
  });

  const formatSize = (mb?: number) => {
    if (mb === undefined || mb === null || mb <= 0) return "0.00 MB";
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const totalLocalSizeMb = localModels.reduce((acc, m) => acc + (m.size_mb || 0), 0);
  const totalAdapters = localModels.filter((m) => m.type === "adapter").length;
  const totalBaseGgufs = localModels.filter((m) => m.type === "base").length;
  const totalHubAvailable = allCards.filter((m) => !m.is_downloaded).length;

  // If a model is active for chat, render the integrated Arena Chat UI with top breadcrumb
  if (activeChatModel) {
    const currentModelObj = allCards.find((m) => m.name === activeChatModel);
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
                  Unified catalog of fine-tuned LoRA adapters, local base GGUFs, and Hub starter models (Qwen2 & Bonsai).
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
              Local Models
            </span>
            <div className="text-2xl font-black text-white font-mono">{localModels.length}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#140F1D] border border-white/5 space-y-1">
            <span className="text-[11px] text-amber-400/80 font-bold uppercase tracking-wider">
              Fine-Tuned LoRA
            </span>
            <div className="text-2xl font-black text-amber-400 font-mono">{totalAdapters}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#140F1D] border border-white/5 space-y-1">
            <span className="text-[11px] text-cyan-400/80 font-bold uppercase tracking-wider">
              Hub Available
            </span>
            <div className="text-2xl font-black text-cyan-400 font-mono">{totalHubAvailable}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#140F1D] border border-white/5 space-y-1">
            <span className="text-[11px] text-emerald-400/80 font-bold uppercase tracking-wider">
              Disk Footprint
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {formatSize(totalLocalSizeMb)}
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
              All Models ({allCards.length})
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
              <span>Local Base ({totalBaseGgufs})</span>
            </button>
            <button
              onClick={() => setActiveFilter("hub")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "hub"
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/40"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Cloud size={12} />
              <span>Hub Starters ({totalHubAvailable})</span>
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
              <span>ONNX Web ({localModels.filter((m) => m.type === "onnx").length})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search local & Hub models..."
              className="w-full bg-[#0B090F] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-all"
            />
          </div>
        </div>

        {/* Model Cards Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40 space-y-3">
            <RefreshCw size={24} className="animate-spin text-amber-400" />
            <span className="text-xs font-bold">Scanning local and Hub models...</span>
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
              const isDownloaded = model.is_downloaded;
              const isBase = model.type === "base" && isDownloaded;
              const isHub = !isDownloaded;
              const downloadState = model.filename ? downloadStates[model.filename] : null;
              const isDownloading = downloadState?.status === "downloading";

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isDownloaded) {
                      setActiveChatModel(model.name);
                    }
                  }}
                  className={`group rounded-3xl bg-[#140F1D] border transition-all duration-300 p-5 pt-4 flex flex-col justify-between space-y-4 relative overflow-hidden shadow-xl hover:shadow-2xl ${
                    isDownloaded ? "cursor-pointer" : "cursor-default"
                  } ${
                    isLoRA
                      ? "border-amber-500/20 hover:border-amber-500/50 hover:shadow-amber-500/5"
                      : isBase
                      ? "border-purple-500/20 hover:border-purple-500/50 hover:shadow-purple-500/5"
                      : isHub
                      ? "border-cyan-500/20 hover:border-cyan-500/50 hover:shadow-cyan-500/5"
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
                        : isHub
                        ? "bg-cyan-500/5 group-hover:bg-cyan-500/10"
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
                            : isHub
                            ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
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
                        ) : isHub ? (
                          <>
                            <Cloud size={11} />
                            <span>Hub Starter</span>
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

                        {model.hf_url && (
                          <a
                            href={model.hf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all"
                            title="View on Hugging Face"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}

                        {isDownloaded && (
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
                        )}
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
                      {model.architecture && (
                        <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-white/70">
                          Arch: <span className="text-white font-semibold">{model.architecture}</span>
                        </div>
                      )}
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

                    {/* Progress Bar if Downloading */}
                    {isDownloading && (
                      <div className="space-y-2 p-3 rounded-2xl bg-black/40 border border-cyan-500/30">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-cyan-300 font-mono truncate mr-2">{downloadState?.message || "Downloading..."}</span>
                          <span className="text-amber-400 font-mono flex-none">{downloadState?.progress || 0}%</span>
                        </div>
                        <div className="w-full h-2 bg-black/60 rounded-full border border-cyan-500/20 overflow-hidden relative shadow-inner p-0.5">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                            style={{ width: `${Math.max(downloadState?.progress || 0, 3)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 h-10">
                      {isDownloaded ? (
                        <>
                          <span className="text-[10px] text-emerald-400/80 flex items-center gap-1.5 font-mono">
                            <CheckCircle2 size={13} className="text-emerald-400" />
                            <span>Locally Available</span>
                          </span>

                          <div className="flex items-center gap-3">
                            {isLoRA && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenUploadModal(model);
                                }}
                                className="text-xs font-semibold text-amber-400/80 hover:text-amber-300 hover:underline flex items-center gap-1 transition-all cursor-pointer"
                                title="Push fine-tuned weights to Hugging Face Hub"
                              >
                                <UploadCloud size={13} />
                                <span>{model.hf_url ? "Re-Push to HF" : "Push to HF"}</span>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveChatModel(model.name);
                              }}
                              className={`h-8 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95 ${
                                isLoRA
                                  ? "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-900/20"
                                  : isBase
                                  ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/20"
                                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20"
                              }`}
                            >
                              <MessageSquare size={13} />
                              <span>Chat Now</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-cyan-400/70 flex items-center gap-1.5 font-mono">
                            <Cloud size={13} className="text-cyan-400" />
                            <span>Hugging Face Hub</span>
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (model.repo_id && model.filename) {
                                handleDownloadModel(model.repo_id, model.filename);
                              }
                            }}
                            disabled={isDownloading}
                            className="h-8 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:from-cyan-900/50 disabled:to-indigo-900/50 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-cyan-900/20 cursor-pointer hover:scale-105 active:scale-95 disabled:scale-100"
                          >
                            {isDownloading ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Downloading...</span>
                              </>
                            ) : (
                              <>
                                <Download size={13} />
                                <span>Download & Test</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Push to Hugging Face Modal */}
      {modelToUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#140F1D] border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 shadow-inner">
                  <UploadCloud size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Push to Hugging Face Hub</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase font-mono">
                      LoRA Model
                    </span>
                  </h3>
                  <p className="text-xs text-white/40">
                    Publish your fine-tuned weights and automated Model Card.
                  </p>
                </div>
              </div>
            </div>

            {/* Hugging Face Auth Banner */}
            <div className="p-3.5 rounded-2xl bg-[#0B090F] border border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                {isHfAuthenticated === null ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-amber-400" />
                    <span className="text-white/60">Verifying HF_TOKEN from .env...</span>
                  </>
                ) : isHfAuthenticated ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-300 font-medium">
                      Authenticated as <strong className="text-white">@{hfUsername}</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                    <span className="text-amber-300">
                      {hfAuthError || "HF_TOKEN not found in .env"}
                    </span>
                  </>
                )}
              </div>
              {isHfAuthenticated && (
                <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Ready to Deploy
                </span>
              )}
            </div>

            {/* Success View */}
            {hfUploadSuccess ? (
              <div className="space-y-4 py-2 animate-in fade-in duration-300">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                    <CheckCircle2 size={18} />
                    <span>Model Successfully Published to Hub!</span>
                  </div>
                  <p className="text-xs text-white/70">
                    Your model adapter weights, config, and Model Card README are now live on Hugging Face.
                  </p>

                  <div className="space-y-2 pt-2">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2">
                      <div className="truncate font-mono text-xs text-white/90">
                        {hfUploadSuccess.url}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(hfUploadSuccess.url);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs"
                          title="Copy Link"
                        >
                          {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                        <a
                          href={hfUploadSuccess.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold transition-all"
                        >
                          <span>Open Repo</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>

                    {hfUploadSuccess.space_url && (
                      <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-2">
                        <div className="truncate font-mono text-xs text-purple-200">
                          Interactive Space: {hfUploadSuccess.space_url}
                        </div>
                        <a
                          href={hfUploadSuccess.space_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-xs font-bold transition-all shrink-0"
                        >
                          <span>Open Space</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setModelToUpload(null);
                      setHfUploadSuccess(null);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-lg cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Config & Upload Form */
              <div className="space-y-4">
                {/* Repo Slug Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/80 flex items-center justify-between">
                    <span>Repository Name</span>
                    <span className="text-[10px] text-white/40 font-mono">
                      Target: {hfUsername || "username"}/{customRepoName.toLowerCase().replace(/[^a-z0-9-_]/g, "-")}-vml
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customRepoName}
                      onChange={(e) => setCustomRepoName(e.target.value)}
                      placeholder="e.g. qwen2-medquad-lora"
                      disabled={isUploadingHf}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#0B090F] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
                    />
                  </div>
                </div>

                {/* Model Specs Preview */}
                <div className="p-3.5 rounded-2xl bg-[#0B090F] border border-white/5 space-y-2">
                  <div className="text-[11px] font-bold text-white/70">Model Card Specs</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="p-2 rounded-lg bg-white/5 text-white/60">
                      Base Model: <span className="text-white font-semibold">{modelToUpload.base_model || "Qwen/Qwen2-0.5B"}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 text-white/60">
                      Dataset: <span className="text-emerald-400 font-semibold">{modelToUpload.dataset_id || "Custom"}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 text-white/60">
                      LoRA Rank: <span className="text-amber-400 font-semibold">{modelToUpload.lora_rank || 16}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 text-white/60">
                      Files: <span className="text-cyan-300 font-semibold">adapter, config, gguf, README</span>
                    </div>
                  </div>
                </div>

                {/* Options: Privacy & Space */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B090F] border border-white/5">
                    <div className="flex items-center gap-2.5">
                      {isPrivateRepo ? <Lock size={15} className="text-amber-400" /> : <Globe size={15} className="text-cyan-400" />}
                      <div>
                        <div className="text-xs font-bold text-white">
                          {isPrivateRepo ? "Private Repository" : "Public Repository"}
                        </div>
                        <div className="text-[10px] text-white/40">
                          {isPrivateRepo ? "Only you can view and download weights" : "Visible on the Hugging Face public Hub"}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPrivateRepo(!isPrivateRepo)}
                      disabled={isUploadingHf}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isPrivateRepo
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {isPrivateRepo ? "Private" : "Public"}
                    </button>
                  </div>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-[#0B090F] border border-white/5 cursor-pointer hover:bg-white/5 transition-all">
                    <input
                      type="checkbox"
                      checked={createSpace}
                      onChange={(e) => setCreateSpace(e.target.checked)}
                      disabled={isUploadingHf}
                      className="w-4 h-4 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500/30"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles size={12} className="text-purple-400" />
                        <span>Auto-Deploy Gradio Space Demo</span>
                      </div>
                      <div className="text-[10px] text-white/40">
                        Launches a live interactive web UI demo on Hugging Face Spaces.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Error Banner */}
                {hfUploadError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>{hfUploadError}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    onClick={() => {
                      setModelToUpload(null);
                      setHfUploadError(null);
                    }}
                    disabled={isUploadingHf}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePushToHf}
                    disabled={isUploadingHf || !isHfAuthenticated}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition-all shadow-lg shadow-amber-900/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingHf ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Publishing to Hub...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={14} />
                        <span>Push Model to Hub</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

