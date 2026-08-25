import {
  Download,
  MessageSquare,
  Send,
  User,
  Bot,
  ChevronDown,
  Trash2,
  Loader2,
  Sparkles,
  Square,
  Columns,
  Maximize2,
  Activity,
  Clock,
  CheckCircle2,
  Copy,
  CloudDownload,
  Cpu,
} from "lucide-react";
import { onnxService } from "../services/onnxInferenceService";
import { Button } from "./Button";
import { useEffect, useRef, useState } from "react";
import { HUB_RECOMMENDED_MODELS, HubRecommendedModel } from "../constants";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  stats?: {
    ttft: number;
    tps: number;
  };
}

interface VMLModel {
  name: string;
  display_name?: string;
  source: "ollama" | "native" | "onnx";
  type?: "base" | "adapter" | "onnx";
  lora_slug?: string;
  onnx_slug?: string;
  details?: {
    parameter_size: string;
    family: string;
  };
}

export interface StarterModelInfo {
  model: HubRecommendedModel;
  isDownloaded: boolean;
  status: "idle" | "downloading" | "ready" | "error";
  progress: number;
  message: string;
}

interface ChatViewProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const renderMessageList = (
  messages: Message[],
  isSending: boolean,
  scrollRef: any,
  onScroll: any,
  stopStream: () => void,
  hasModels: boolean = true,
  starterModels: StarterModelInfo[] = [],
  onDownloadModel?: (repo_id: string, filename: string) => void,
  onSelectModel?: (modelName: string) => void
) => {
  return (
    <div
      className={`flex-1 flex flex-col relative w-full h-full overflow-hidden`}
    >
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={`flex-1 overflow-y-auto w-full scroll-smooth custom-scrollbar relative z-0`}
      >
        <div
          className={`max-w-4xl mx-auto px-6 space-y-10 ${messages.length === 0 ? "h-full flex items-center justify-center" : "py-12"}`}
        >
          {!hasModels ? (
            <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-2xl mx-auto p-8 rounded-3xl bg-gradient-to-b from-[#140F1D] to-[#0B090F] border border-purple-500/20 shadow-2xl animate-in fade-in duration-500">
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-purple-400 shadow-lg shadow-purple-500/10">
                <Bot size={36} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Starter SLM Suite • Instant Local Inference
                </h3>
                <p className="text-xs text-white/50 max-w-md mx-auto leading-relaxed">
                  Download ultra-compact models to immediately chat, benchmark, and test in the Native Arena without cloud API tokens.
                </p>
              </div>

              {/* Starter Models Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left pt-2">
                {starterModels.map((item) => {
                  const m = item.model;
                  const isDownloading = item.status === "downloading";
                  const isReady = item.isDownloaded || item.status === "ready";

                  return (
                    <div
                      key={m.filename}
                      className={`p-5 rounded-2xl bg-[#0B090F] border transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden ${
                        isReady
                          ? "border-emerald-500/30 hover:border-emerald-500/60"
                          : m.architecture.includes("Bonsai")
                          ? "border-cyan-500/30 hover:border-cyan-500/60"
                          : "border-purple-500/30 hover:border-purple-500/60"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              isReady
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : m.architecture.includes("Bonsai")
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                            }`}
                          >
                            {isReady ? "Ready Locally" : m.quantization}
                          </span>

                          <span className="text-[11px] font-mono text-amber-400 font-bold">
                            ~{m.size_mb} MB
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-white tracking-tight">
                            {m.display_name}
                          </h4>
                          <p className="text-[11px] text-white/40 mt-1 leading-relaxed line-clamp-2">
                            {m.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono pt-1">
                          <span>{m.parameters}</span> • <span>{m.context_length} Context</span>
                        </div>
                      </div>

                      {/* Download Progress Bar */}
                      {isDownloading && (
                        <div className="space-y-2 p-2.5 rounded-xl bg-black/50 border border-cyan-500/30">
                          <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                            <span className="text-cyan-300 truncate mr-2">{item.message || "Downloading..."}</span>
                            <span className="text-amber-400 flex-none">{item.progress || 0}%</span>
                          </div>
                          <div className="w-full h-2 bg-black/60 rounded-full border border-cyan-500/20 overflow-hidden relative shadow-inner p-0.5">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                              style={{ width: `${Math.max(item.progress || 0, 3)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      <div>
                        {isReady ? (
                          <button
                            onClick={() => onSelectModel && onSelectModel(m.filename)}
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 size={14} />
                            <span>Select & Chat</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onDownloadModel && onDownloadModel(m.repo_id, m.filename)}
                            disabled={isDownloading}
                            className={`w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:scale-100 ${
                              m.architecture.includes("Bonsai")
                                ? "bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-cyan-900/20"
                                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-900/20"
                            }`}
                          >
                            {isDownloading ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Downloading ({item.progress || 0}%)...</span>
                              </>
                            ) : (
                              <>
                                <Download size={14} />
                                <span>Download & Test (~{m.size_mb} MB)</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4 opacity-60 animate-in fade-in zoom-in duration-700 select-none">
              <Sparkles size={48} className="text-purple-400/50" />
              <p className="text-[#E2D8F0] text-2xl font-light tracking-tight italic">
                "What shall we create today?"
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isAssistant = msg.role === "assistant";
                const isLast = idx === messages.length - 1;

                let thought = msg.reasoning || "";
                let finalContent = msg.content;

                if (!thought) {
                  const thoughtStartMatch = msg.content.match(
                    /<(thought|thinking)>|\[THOUGHT\]|\bthought:/i,
                  );
                  if (thoughtStartMatch) {
                    const startTag = thoughtStartMatch[0];
                    const startIndex =
                      thoughtStartMatch.index! + startTag.length;
                    const endMatch = msg.content.match(
                      /<\/(thought|thinking)>|\[\/THOUGHT\]|\n\n/i,
                    );

                    if (endMatch) {
                      thought = msg.content
                        .slice(startIndex, endMatch.index!)
                        .trim();
                      finalContent = msg.content
                        .slice(endMatch.index! + endMatch[0].length)
                        .trim();
                    } else {
                      thought = msg.content.slice(startIndex).trim();
                      finalContent = "";
                    }
                  }
                }

                return (
                  <div
                    key={idx}
                    className={`flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isAssistant ? "" : "flex-row-reverse"}`}
                  >
                    <div
                      className={`flex-none w-10 h-10 rounded-2xl flex items-center justify-center border shadow-lg ${
                        isAssistant
                          ? "bg-purple-600/10 border-purple-500/30 text-purple-400 shadow-purple-500/5"
                          : "bg-indigo-600/10 border-indigo-500/30 text-indigo-400 shadow-indigo-500/5"
                      }`}
                    >
                      {isAssistant ? <Bot size={20} /> : <User size={20} />}
                    </div>
                    <div
                      className={`flex-1 space-y-2 ${isAssistant ? "" : "text-right"}`}
                    >
                      <div
                        className={`inline-block text-[15px] p-5 rounded-[1.5rem] shadow-xl ${
                          isAssistant
                            ? "bg-[#1D152A] text-[#E2D8F0]/90 rounded-tl-none border border-[#352554]"
                            : "bg-purple-600/20 text-white rounded-tr-none border border-purple-500/40"
                        }`}
                      >
                        {isAssistant && thought && (
                          <div className="mb-4 overflow-hidden rounded-xl border border-purple-500/20 bg-purple-500/5">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border-b border-purple-500/10">
                              <Loader2
                                className={`text-purple-400 ${isSending && isLast && !finalContent ? "animate-spin" : ""}`}
                                size={10}
                              />
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                {isSending && isLast && !finalContent
                                  ? "Reasoning..."
                                  : "Thought Process"}
                              </span>
                            </div>
                            <div className="p-3 text-xs text-[#9480B3] italic leading-relaxed text-left border-l-2 border-purple-500/30 ml-2 my-2">
                              {thought}
                            </div>
                          </div>
                        )}

                        <div className="leading-relaxed whitespace-pre-wrap text-left relative">
                          {(() => {
                            const content =
                              finalContent || (thought ? "" : msg.content);
                            const parts = content.split(/(\[IMAGE: [^\]]+\])/g);
                            return parts.map((part, i) => {
                              if (
                                part.startsWith("```") &&
                                part.endsWith("```")
                              ) {
                                const lines = part.slice(3, -3).trim();
                                const firstLineEnd = lines.indexOf("\n");
                                const language =
                                  firstLineEnd !== -1
                                    ? lines.slice(0, firstLineEnd).trim()
                                    : "";
                                const code =
                                  firstLineEnd !== -1
                                    ? lines.slice(firstLineEnd + 1)
                                    : lines;

                                return (
                                  <div
                                    key={i}
                                    className="my-4 rounded-xl overflow-hidden border border-[#352554] bg-[#0B090F]"
                                  >
                                    <div className="flex items-center justify-between px-4 py-2 bg-[#140F1D] border-b border-[#352554] text-xs text-gray-400">
                                      <span className="font-mono">
                                        {language || "code"}
                                      </span>
                                      <button
                                        onClick={() =>
                                          navigator.clipboard.writeText(code)
                                        }
                                        className="hover:text-white transition-colors"
                                      >
                                        Copy
                                      </button>
                                    </div>
                                    <pre className="p-4 text-xs font-mono overflow-x-auto text-[#E2D8F0]">
                                      <code>{code}</code>
                                    </pre>
                                  </div>
                                );
                              }
                              return part;
                            });
                          })()}
                          {isAssistant && isLast && isSending && (
                            <span className="inline-block w-1.5 h-4 ml-1 bg-purple-500/50 animate-pulse rounded-full align-middle" />
                          )}
                        </div>

                        {isAssistant && msg.stats && (
                          <div className="mt-4 pt-3 border-t border-purple-500/10 flex items-center gap-4 text-[10px] font-medium tracking-wider uppercase">
                            <div className="flex items-center gap-1.5 text-purple-400/70">
                              <Clock size={10} />
                              <span>
                                TTFT: {Math.round(msg.stats.ttft)}ms
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-indigo-400/70">
                              <Activity size={10} />
                              <span>
                                Speed: {msg.stats.tps} t/s
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {isSending && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={stopStream}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 hover:bg-indigo-500/30 shadow-lg shadow-indigo-900/40 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
          >
            <Square size={14} fill="currentColor" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Stop
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

interface ModelSelectorProps {
  val: string;
  onChange: (v: string) => void;
  allModels: VMLModel[];
  isSending: boolean;
  onnxStatus: Record<string, { status: "idle" | "downloading" | "ready"; progress: number }>;
  onDownloadOnnx: (model: VMLModel) => void;
  downloadStates: Record<string, { status: string; progress: number; message: string }>;
  onDownloadStarterModel: (repo_id: string, filename: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  val,
  onChange,
  allModels,
  isSending,
  onnxStatus,
  onDownloadOnnx,
  downloadStates,
  onDownloadStarterModel,
}) => {
  const selectedObj = allModels.find((m) => m.name === val);
  const isOnnx = selectedObj?.source === "onnx";
  const status =
    isOnnx && selectedObj?.onnx_slug
      ? onnxStatus[selectedObj.onnx_slug]
      : null;

  return (
    <div className="flex items-center gap-2">
      <div className="relative group">
        <select
          value={val}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-[#1D152A] border border-purple-500/30 text-[#E2D8F0] text-xs py-2 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer hover:bg-[#251B36] max-w-[180px] truncate"
          disabled={allModels.length === 0 || isSending}
        >
          {allModels.length > 0 ? (
            allModels.map((m) => (
              <option key={`${m.source}-${m.name}`} value={m.name}>
                {m.name.toUpperCase()}{" "}
                {m.details?.parameter_size
                  ? `• ${m.details.parameter_size}`
                  : ""}
              </option>
            ))
          ) : (
            <option>No Models Available</option>
          )}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400">
          <ChevronDown size={14} />
        </div>
      </div>

      {/* Quick Download Buttons for Starter Models not yet downloaded locally */}
      {HUB_RECOMMENDED_MODELS.filter(
        (rec) =>
          !allModels.some(
            (m) =>
              m.name.toLowerCase() === rec.filename.toLowerCase() ||
              m.name.toLowerCase().includes(rec.filename.toLowerCase().replace(".gguf", ""))
          )
      ).map((rec) => {
        const dState = downloadStates[rec.filename];
        const isDownloading = dState?.status === "downloading";
        return (
          <button
            key={rec.filename}
            onClick={() => onDownloadStarterModel(rec.repo_id, rec.filename)}
            disabled={isDownloading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
              rec.architecture.includes("Bonsai")
                ? "bg-cyan-600/20 border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 shadow-sm"
                : "bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30 shadow-sm"
            }`}
            title={`Download & Test ${rec.display_name}`}
          >
            {isDownloading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Downloading ({dState?.progress || 0}%)...</span>
              </>
            ) : (
              <>
                <Download size={12} />
                <span>Get {rec.display_name.split(" ")[0]} {rec.parameters} (~{rec.size_mb} MB)</span>
              </>
            )}
          </button>
        );
      })}

      {isOnnx && selectedObj && (
        <div className="flex items-center gap-2">
          {!status || status.status === "idle" ? (
            <button
              onClick={() => onDownloadOnnx(selectedObj)}
              className="p-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-all shadow-lg shadow-indigo-500/5 group"
              title="Download for Edge Chat"
            >
              <CloudDownload
                size={16}
                className="group-hover:scale-110 transition-transform"
              />
            </button>
          ) : status.status === "downloading" ? (
            <div className="flex items-center gap-3 bg-[#1D152A] border border-indigo-500/30 px-3 py-1.5 rounded-xl min-w-[120px]">
              <div className="flex-1 h-1 bg-indigo-500/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-indigo-400 font-mono">
                {status.progress}%
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Cpu size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Edge Ready
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ChatView: React.FC<ChatViewProps> = ({
  selectedModel,
  onModelChange,
}) => {
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [selectedModel2, setSelectedModel2] = useState("");
  const [nativeModels, setNativeModels] = useState<VMLModel[]>([]);
  const allModels = nativeModels;

  const [downloadStates, setDownloadStates] = useState<{
    [filename: string]: { status: string; progress: number; message: string };
  }>({});

  const fetchNativeModels = async () => {
    try {
      const res = await fetch("http://127.0.0.1:2000/list_native_models");
      const data = await res.json();
      const newModels = data.models || [];
      setNativeModels((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(newModels)) {
          return prev;
        }
        return newModels;
      });
    } catch (e) {
      console.warn("Native models offline");
    }
  };

  const checkStarterStatus = async () => {
    try {
      for (const rec of HUB_RECOMMENDED_MODELS) {
        const res = await fetch(
          `http://127.0.0.1:2000/models/gguf_status?filename=${encodeURIComponent(rec.filename)}`
        );
        if (res.ok) {
          const data = await res.json();
          setDownloadStates((prev) => {
            const current = prev[rec.filename];
            const newProgress = data.progress || (data.is_present ? 100 : 0);
            const newStatus = data.status || (data.is_present ? "ready" : "idle");
            if (
              current &&
              current.status === newStatus &&
              current.progress === newProgress &&
              current.message === (data.message || "")
            ) {
              return prev;
            }
            return {
              ...prev,
              [rec.filename]: {
                status: newStatus,
                progress: newProgress,
                message: data.message || "",
              },
            };
          });
        }
      }
    } catch (e) {}
  };

  // Initial check on mount
  useEffect(() => {
    checkStarterStatus();
    fetchNativeModels();
  }, []);

  // Poll only when there is an active download
  useEffect(() => {
    const hasActiveDownloads = Object.values(downloadStates).some(
      (s) => s?.status === "downloading"
    );
    if (!hasActiveDownloads) return;

    const interval = setInterval(() => {
      checkStarterStatus();
      fetchNativeModels();
    }, 1500);

    return () => clearInterval(interval);
  }, [downloadStates]);


  const handleDownloadStarterModel = async (repo_id: string, filename: string) => {
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
      if (res.ok) {
        setDownloadStates((prev) => ({
          ...prev,
          [filename]: {
            status: "downloading",
            progress: 10,
            message: "Downloading from Hugging Face...",
          },
        }));
      }
    } catch (e) {
      setDownloadStates((prev) => ({
        ...prev,
        [filename]: { status: "error", progress: 0, message: "Failed to trigger download." },
      }));
    }
  };

  const starterModelInfos: StarterModelInfo[] = HUB_RECOMMENDED_MODELS.map((rec) => {
    const isDownloaded = nativeModels.some(
      (m) =>
        m.name.toLowerCase() === rec.filename.toLowerCase() ||
        m.name.toLowerCase().includes(rec.filename.toLowerCase().replace(".gguf", ""))
    );
    const dState = downloadStates[rec.filename];
    return {
      model: rec,
      isDownloaded,
      status: isDownloaded ? "ready" : ((dState?.status as any) || "idle"),
      progress: isDownloaded ? 100 : dState?.progress || 0,
      message: dState?.message || "",
    };
  });


  const [reportCopied, setReportCopied] = useState(false);

  const handleCopyLatestReport = () => {
    if (messagesA.length < 2) return;

    // Find the latest assistant message
    const lastAssistantIdx = [...messagesA]
      .reverse()
      .findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx === -1) return;

    const actualIdx = messagesA.length - 1 - lastAssistantIdx;
    const assistantMsg = messagesA[actualIdx];
    const userMsg =
      actualIdx > 0 ? messagesA[actualIdx - 1] : { content: "Unknown" };

    const report = `[VML Model Diagnostic Report]
Model: ${selectedModel}
TTFT: ${Math.round(assistantMsg.stats?.ttft || 0)}ms
Speed: ${assistantMsg.stats?.tps || 0} t/s

--- USER QUERY ---
${userMsg.content}

--- AI RESPONSE ---
${assistantMsg.content}`;

    navigator.clipboard.writeText(report);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  const [messagesA, setMessagesA] = useState<Message[]>([]);
  const [messagesB, setMessagesB] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [isSendingA, setIsSendingA] = useState(false);
  const [isSendingB, setIsSendingB] = useState(false);
  const isSending = isSendingA || isSendingB;

  const [onnxStatus, setOnnxStatus] = useState<
    Record<string, { status: "idle" | "downloading" | "ready"; progress: number }>
  >({});

  const scrollA = useRef<HTMLDivElement>(null);
  const scrollB = useRef<HTMLDivElement>(null);
  const nearBottomA = useRef(true);
  const nearBottomB = useRef(true);

  const abortA = useRef<AbortController | null>(null);
  const abortB = useRef<AbortController | null>(null);



  useEffect(() => {
    if (allModels.length > 0) {
      if (!selectedModel) onModelChange(allModels[0].name);
      if (!selectedModel2)
        setSelectedModel2(
          allModels.length > 1 ? allModels[1].name : allModels[0].name,
        );
    }
  }, [allModels]);

  const handleScrollA = () => {
    if (!scrollA.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollA.current;
    nearBottomA.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  const handleScrollB = () => {
    if (!scrollB.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollB.current;
    nearBottomB.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  useEffect(() => {
    if (nearBottomA.current && scrollA.current)
      scrollA.current.scrollTop = scrollA.current.scrollHeight;
  }, [messagesA]);

  useEffect(() => {
    if (nearBottomB.current && scrollB.current)
      scrollB.current.scrollTop = scrollB.current.scrollHeight;
  }, [messagesB]);

  const handleStop = () => {
    if (abortA.current) {
      abortA.current.abort();
      abortA.current = null;
    }
    if (abortB.current) {
      abortB.current.abort();
      abortB.current = null;
    }
    setIsSendingA(false);
    setIsSendingB(false);
  };

  const fetchStream = async (
    modelName: string,
    history: Message[],
    setMsg: React.Dispatch<React.SetStateAction<Message[]>>,
    setSending: React.Dispatch<React.SetStateAction<boolean>>,
    abortCtrl: React.MutableRefObject<AbortController | null>,
  ) => {
    if (abortCtrl.current) abortCtrl.current.abort();
    abortCtrl.current = new AbortController();
    setSending(true);

    const url = "http://127.0.0.1:2000/v1/native/chat";
    const modelObj = allModels.find(
      (m) =>
        m.name === modelName ||
        m.lora_slug === modelName ||
        m.display_name === modelName ||
        (m.lora_slug && modelName.includes(m.lora_slug))
    );
    const baseGguf =
      allModels.find((m) => m.type === "base")?.name ||
      "qwen2-0_5b-instruct-q4_k_m.gguf";

    const body = {
      model_filename:
        modelObj?.type === "base"
          ? modelObj.name
          : baseGguf,
      messages: history,
      lora_slug: modelObj?.lora_slug,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortCtrl.current.signal,
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setMsg((prev) => [
        ...prev,
        { role: "assistant", content: "", reasoning: "" },
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.done) break;
              if (data.error) {
                setMsg((prev) => {
                  if (prev.length === 0) return prev;
                  const last = prev[prev.length - 1];
                  if (!last || last.role !== "assistant") return prev;
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: `Error: ${data.error}` },
                  ];
                });
                break;
              }

              if (data.content !== undefined) {
                setMsg((prev) => {
                  if (prev.length === 0) return prev;
                  const last = prev[prev.length - 1];
                  if (!last || last.role !== "assistant") return prev;

                  const raw = data.content;
                  let newReasoning = last.reasoning || "";
                  let newContent = last.content || "";

                  if (raw.includes("<think>")) {
                    const thinkParts = raw.split("<think>");
                    if (thinkParts[1]) {
                      const innerParts = thinkParts[1].split("</think>");
                      newReasoning += innerParts[0];
                      if (innerParts[1]) {
                        newContent += innerParts[1];
                      }
                    }
                  } else if (raw.includes("</think>")) {
                    const thinkParts = raw.split("</think>");
                    newReasoning += thinkParts[0];
                    if (thinkParts[1]) {
                      newContent += thinkParts[1];
                    }
                  } else {
                    newContent += raw;
                  }

                  const newStats =
                    data.ttft || data.tps
                      ? {
                          ttft: data.ttft || last.stats?.ttft || 0,
                          tps: data.tps || last.stats?.tps || 0,
                        }
                      : last.stats;

                  const updatedLast: Message = {
                    ...last,
                    content: newContent,
                    reasoning: newReasoning,
                    stats: newStats,
                  };

                  return [...prev.slice(0, -1), updatedLast];
                });
              }
            } catch (err) {
              console.error("Error parsing stream chunk:", err, dataStr);
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMsg((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (!last || last.role !== "assistant") return prev;
          return [
            ...prev.slice(0, -1),
            { ...last, content: `Failed to generate response: ${e.message}` },
          ];
        });
      }
    } finally {
      setSending(false);
      abortCtrl.current = null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedModel || isSending) return;

    const userDisplayMsg: Message = {
      role: "user",
      content: input,
    };

    const newModelHistoryA = [...messagesA, userDisplayMsg];
    setMessagesA((prev) => [...prev, userDisplayMsg]);

    let newModelHistoryB: Message[] = [];
    if (isSplitMode && selectedModel2) {
      newModelHistoryB = [...messagesB, userDisplayMsg];
      setMessagesB((prev) => [...prev, userDisplayMsg]);
    }

    setInput("");

    const modelA = allModels.find((m) => m.name === selectedModel);
    const modelB = selectedModel2
      ? allModels.find((m) => m.name === selectedModel2)
      : null;

    const executeChat = async (
      model: any,
      history: Message[],
      setMsgs: any,
      setIsSending: any,
      abort: any,
    ) => {
      if (model?.source === "onnx" && model.onnx_slug) {
        setIsSending(true);
        setMsgs((prev) => [
          ...prev,
          { role: "assistant", content: "", reasoning: "" },
        ]);

        // Ensure session is ready
        await onnxService.initSession(model.onnx_slug);

        await onnxService.generate(
          history[history.length - 1].content,
          (token) => {
            setMsgs((prev) => {
              const newMessages = [...prev];
              const last = newMessages[newMessages.length - 1];
              newMessages[newMessages.length - 1] = {
                ...last,
                content: last.content + token,
              };
              return newMessages;
            });
          },
        );
        setIsSending(false);
      } else {
        await fetchStream(
          model?.name || selectedModel,
          history,
          setMsgs,
          setIsSending,
          abort,
        );
      }
    };

    const promises = [
      executeChat(
        modelA,
        newModelHistoryA,
        setMessagesA,
        setIsSendingA,
        abortA,
      ),
    ];
    if (isSplitMode && modelB) {
      promises.push(
        executeChat(
          modelB,
          newModelHistoryB,
          setMessagesB,
          setIsSendingB,
          abortB,
        ),
      );
    }

    await Promise.all(promises);
  };

  const handleDownloadOnnx = async (model: VMLModel) => {
    if (!model.onnx_slug) return;
    const slug = model.onnx_slug;

    setOnnxStatus((prev) => ({
      ...prev,
      [slug]: { status: "downloading", progress: 0 },
    }));

    const success = await onnxService.downloadModel(slug, (p) => {
      setOnnxStatus((prev) => ({
        ...prev,
        [slug]: { status: "downloading", progress: p.percentage },
      }));
    });

    if (success) {
      setOnnxStatus((prev) => ({
        ...prev,
        [slug]: { status: "ready", progress: 100 },
      }));
    } else {
      setOnnxStatus((prev) => ({
        ...prev,
        [slug]: { status: "idle", progress: 0 },
      }));
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0B090F] relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex-none shrink-0 h-[64px] border-b border-[#352554]/50 bg-[#140F1D]/50 backdrop-blur-md px-6 flex items-center justify-between z-10 w-full shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <MessageSquare className="text-purple-400" size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#E2D8F0]">VML Arena</h2>
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse`}
              />
              <span className="text-[10px] text-[#9480B3] uppercase tracking-widest font-bold">
                Native Engine Ready
              </span>
            </div>
          </div>
        </div>

        {/* Central Controls */}
        <div className="flex items-center gap-2">
          <ModelSelector
            val={selectedModel}
            onChange={onModelChange}
            allModels={allModels}
            isSending={isSending}
            onnxStatus={onnxStatus}
            onDownloadOnnx={handleDownloadOnnx}
            downloadStates={downloadStates}
            onDownloadStarterModel={handleDownloadStarterModel}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSplitMode(!isSplitMode)}
            title={isSplitMode ? "Single View" : "Arena Split View"}
            className={`px-3 transition-colors ${isSplitMode ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30" : "text-gray-400"}`}
          >
            {isSplitMode ? <Maximize2 size={16} /> : <Columns size={16} />}
          </Button>

          {isSplitMode && (
            <ModelSelector
              val={selectedModel2}
              onChange={setSelectedModel2}
              allModels={allModels}
              isSending={isSending}
              onnxStatus={onnxStatus}
              onDownloadOnnx={handleDownloadOnnx}
              downloadStates={downloadStates}
              onDownloadStarterModel={handleDownloadStarterModel}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLatestReport}
            disabled={messagesA.length < 2}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              reportCopied
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold"
                : "text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 disabled:opacity-30"
            }`}
            title="Copy Diagnostic Report"
          >
            {reportCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessagesA([]);
              setMessagesB([]);
              abortA.current?.abort();
              abortB.current?.abort();
            }}
            title="Clear Chat"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex w-full relative z-0 overflow-hidden">
        {renderMessageList(
          messagesA,
          isSendingA,
          scrollA,
          handleScrollA,
          () => {
            if (abortA.current) {
              abortA.current.abort();
              abortA.current = null;
            }
          },
          allModels.length > 0,
          starterModelInfos,
          handleDownloadStarterModel,
          (name) => onModelChange(name)
        )}

        {isSplitMode && (
          <>
            <div className="w-[1px] bg-[#352554]/50 z-10 hidden md:block" />
            <div className="bg-[#0B090F]/50 flex-1 h-full w-full max-w-full overflow-hidden flex">
              {renderMessageList(
                messagesB,
                isSendingB,
                scrollB,
                handleScrollB,
                () => {
                  if (abortB.current) {
                    abortB.current.abort();
                    abortB.current = null;
                  }
                },
                allModels.length > 0,
                starterModelInfos,
                handleDownloadStarterModel,
                (name) => setSelectedModel2(name)
              )}
            </div>
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-none p-6 bg-gradient-to-t from-[#0B090F] to-transparent z-10 w-full">
        <div className="max-w-4xl mx-auto relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Enter prompt"
            ref={inputRef}
            className="w-full bg-[#140F1D]/80 backdrop-blur-xl border border-[#352554] rounded-3xl p-5 pr-16 text-[#E2D8F0] placeholder-[#9480B3] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none shadow-2xl h-[72px]"
            rows={1}
          />
          <button
            onClick={isSending ? handleStop : handleSend}
            disabled={!input.trim() && !isSending}
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isSending
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 hover:bg-indigo-500/30 shadow-lg shadow-indigo-900/40 active:scale-95"
                : input.trim()
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40 hover:scale-105 active:scale-95"
                  : "bg-[#1D152A] text-gray-500 cursor-not-allowed"
            }`}
          >
            {isSending ? (
              <Square size={18} fill="currentColor" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
