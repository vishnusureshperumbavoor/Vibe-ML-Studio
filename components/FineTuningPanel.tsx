import React, { useEffect } from 'react';
import { Zap, Activity, CheckCircle2, ExternalLink, Square, Sparkles } from 'lucide-react';
import { SmartSelector } from './SmartSelector';

interface FineTuningPanelProps {
  onStart: (modelId: string, datasetId: string, hardware: string, maxSteps: number, rank: number, persona?: string) => void;
  onStop?: () => void;
  isExecuting: boolean;
  systemInfo?: any;
  preSelectedDataset?: string | null;
  onClearSelection?: () => void;
  deploymentUrl?: string | null;
  onTestInArena?: () => void;
  modelId: string;
  setModelId: (val: string) => void;
  datasetId: string;
  setDatasetId: (val: string) => void;
  hardware: string;
  setHardware: (val: string) => void;
  maxSteps: number;
  setMaxSteps: (val: number) => void;
  rank: number;
  setRank: (val: number) => void;
  persona?: string;
  setPersona?: (val: string) => void;
}

export const FineTuningPanel: React.FC<FineTuningPanelProps> = ({ 
  onStart, 
  onStop,
  isExecuting, 
  systemInfo, 
  preSelectedDataset,
  onClearSelection,
  deploymentUrl,
  onTestInArena,
  modelId,
  setModelId,
  datasetId,
  setDatasetId,
  hardware,
  setHardware,
  maxSteps,
  setMaxSteps,
  rank,
  setRank,
  persona = "",
  setPersona
}) => {

  useEffect(() => {
    if (preSelectedDataset) {
      setDatasetId(preSelectedDataset);
      // Clean up the pre-selection so subsequent mounts don't force it
      if (onClearSelection) onClearSelection();
    }
  }, [preSelectedDataset]);

  const RECOMMENDED_MODELS = [
    { id: 'Qwen/Qwen2-0.5B', downloads: 1250000, likes: 4500, is_cpu_ready: true },
    { id: 'HuggingFaceTB/SmolLM-135M', downloads: 850000, likes: 2200, is_cpu_ready: true },
    { id: 'microsoft/Phi-3-mini-4k-instruct', downloads: 3500000, likes: 8900, is_cpu_ready: true },
  ];

  const RECOMMENDED_DATASETS = [
    { id: 'vishnusureshperumbavoor/vsp_alpaca', downloads: 15, likes: 5 },
    { id: 'lavita/MedQuAD', downloads: 85000, likes: 320 },
    { id: 'tatsu-lab/alpaca', downloads: 450000, likes: 1200 },
    { id: 'yahma/alpaca-cleaned', downloads: 220000, likes: 850 },
    { id: 'HuggingFaceH4/instruction-dataset', downloads: 150000, likes: 600 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Success Modal/Overlay */}
      {deploymentUrl && (
        <div className="absolute inset-0 z-50 rounded-[32px] overflow-hidden">
          <div className="absolute inset-0 bg-[#0B090F]/90 backdrop-blur-xl animate-in fade-in duration-500" />
          <div className="relative h-full flex flex-col items-center justify-center p-12 text-center space-y-8 animate-in zoom-in-95 slide-in-from-bottom-8 duration-700">
            <div className="relative">
              <div className="absolute -inset-4 bg-amber-500/20 blur-2xl rounded-full animate-pulse" />
              <CheckCircle2 size={64} className="text-amber-500 relative" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-white tracking-tight italic uppercase">Mission Accomplished</h3>
              <p className="text-white/40 text-sm max-w-sm">Your model has been fine-tuned, optimized, and synced to the cloud successfully.</p>
            </div>

            <div className="flex flex-col w-full gap-3 max-w-xs">
              <a 
                href={deploymentUrl} 
                target="_blank" 
                rel="noreferrer"
                className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:shadow-amber-500/20"
              >
                <ExternalLink size={16} />
                View it on Hugging Face
              </a>
              <button 
                onClick={onTestInArena}
                className="w-full py-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center justify-center gap-3"
              >
                <Activity size={16} />
                Test in VML Arena
              </button>
            </div>
          </div>
        </div>
      )}

      {systemInfo && (
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-full w-fit mx-auto animate-in zoom-in-95 duration-700">
          <Activity size={12} className="text-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-widest flex items-center gap-2">
            System Bridge Active: <span className="text-white/60">{systemInfo.cpu_threads} Threads</span> 
            {systemInfo.gpu.available && (
              <span className="flex items-center gap-2">
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                {systemInfo.gpu.name} ({systemInfo.gpu.vram_gb}GB)
              </span>
            )}
            <span className="flex items-center gap-2">
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              {systemInfo.ram_gb}GB RAM
            </span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Base Model</label>
          <SmartSelector 
            type="model" 
            placeholder="Select model to train..." 
            onSelect={setModelId} 
            defaultValue={modelId}
            suggestions={RECOMMENDED_MODELS}
          />
          <p className="text-[10px] text-white/30 px-1">Tip: Qwen-0.5B is optimized for fast CPU fine-tuning on 32GB RAM.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Knowledge Dataset</label>
          <SmartSelector 
            type="dataset" 
            placeholder="Select instruction dataset..." 
            onSelect={setDatasetId} 
            defaultValue={datasetId}
            suggestions={RECOMMENDED_DATASETS}
          />
          <p className="text-[10px] text-white/30 px-1">Try: 'lavita/MedQuAD' for medical QA or 'yahma/alpaca-cleaned' for general tasks.</p>
        </div>
      </div>

      {/* Native Persona & Identity Alignment */}
      <div className="p-4 rounded-2xl bg-[#140F1D] border border-purple-500/30 space-y-3 shadow-lg shadow-purple-500/5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <label className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">
              Native Persona & Identity (Baked directly into weights)
            </label>
          </div>
          <span className="text-[9px] text-purple-400/70 font-mono">Zero system prompt needed</span>
        </div>

        <input
          type="text"
          value={persona}
          onChange={(e) => setPersona?.(e.target.value)}
          placeholder="e.g. Clinical Radiologist & Medical Specialist"
          className="w-full px-4 py-2.5 bg-[#0B090F] border border-[#352554] rounded-xl text-xs text-white placeholder-white/20 focus:outline-none focus:border-purple-500/60 transition-all font-medium"
        />

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider mr-1">Presets:</span>
          {[
            { label: "⚡ VSP", value: "Vishnu Suresh Perumbavoor - AI Engineer, Researcher & Open-Source Developer" },
            { label: "🩺 Clinical Radiologist", value: "Clinical Radiologist & Medical Specialist" },
            { label: "🏥 Medical Doctor", value: "Medical Doctor & Clinical Specialist" },
            { label: "💻 AI & Python Engineer", value: "Senior AI & Python Engineer" },
            { label: "⚖️ Legal Counsel", value: "Corporate & Legal Advisory Specialist" },
            { label: "🎓 Research Scientist", value: "Biomedical Research Scientist" },
          ].map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setPersona?.(preset.value)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                persona === preset.value
                  ? "bg-purple-500/30 text-purple-200 border border-purple-500/50"
                  : "bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8 py-4">
        {/* Max Steps Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="space-y-0.5">
              <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                Training Steps
                <Activity size={10} className="text-amber-500/50" />
              </label>
              <p className="text-[8px] text-white/20 font-medium">
                Total optimization iterations on the dataset.
              </p>
            </div>
            <div className="text-sm font-black tabular-nums px-4 py-1.5 rounded-full border transition-all text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
              {maxSteps} <span className="text-[8px] opacity-50 ml-0.5 font-bold">STEPS</span>
            </div>
          </div>
          <input
            type="range"
            min="5"
            max="1000"
            step="5"
            value={maxSteps}
            onChange={(e) => setMaxSteps(parseInt(e.target.value))}
            className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all border border-white/5"
          />
          <div className="flex justify-between text-[8px] font-bold text-white/20 tracking-tighter px-1 uppercase">
            <span>Quick Adaptation (5 - 50)</span>
            <span>Standard Domain SFT (100 - 300)</span>
            <span>Deep Knowledge Injection (500+)</span>
          </div>
        </div>

        {/* LoRA Rank Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="space-y-0.5">
              <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                LoRA Rank (R)
                <Zap size={10} className="text-purple-500/50" />
              </label>
              <p className="text-[8px] text-white/20 font-medium">Controls the model's new learning capacity.</p>
            </div>
            <div className="text-sm font-black text-purple-400 tabular-nums bg-purple-500/10 px-4 py-1.5 rounded-full border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
              {rank} <span className="text-[8px] opacity-50 ml-0.5 font-bold">CAPACITY</span>
            </div>
          </div>
          <input
            type="range"
            min="2"
            max="8"
            step="1"
            value={Math.log2(rank)}
            onChange={(e) => setRank(Math.pow(2, parseInt(e.target.value)))}
            className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all border border-white/5"
          />
          <div className="flex justify-between text-[8px] font-bold text-white/20 tracking-tighter px-1 uppercase">
            <span>Lightweight Logic</span>
            <span>Complex Creative Reasoning</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Execution Hardware</label>
        <div className="flex gap-2">
          {['CPU', 'GPU'].map((hw) => (
            <button
              key={hw}
              onClick={() => setHardware(hw)}
              className={`flex-1 p-3 rounded-xl border text-xs font-bold transition-all
                ${hardware === hw 
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' 
                  : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'}
              `}
            >
              {hw} {hw === 'CPU' ? '🐌' : '🔥'}
            </button>
          ))}
        </div>
      </div>

      {isExecuting ? (
        <button
          onClick={onStop}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all shadow-2xl scale-100 active:scale-95 bg-red-600 hover:bg-red-500 text-white shadow-red-900/30 cursor-pointer"
        >
          <Square size={18} fill="currentColor" />
          <span>STOP TRAINING PROCESS</span>
        </button>
      ) : (
        <button
          disabled={!modelId || !datasetId}
          onClick={() => onStart(modelId, datasetId, hardware, maxSteps, rank, persona)}
          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all shadow-2xl scale-100 active:scale-95
            ${!modelId || !datasetId 
              ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' 
              : 'bg-amber-500 text-black hover:bg-amber-400 hover:shadow-amber-500/20 cursor-pointer'}
          `}
        >
          <Zap size={18} fill="currentColor" />
          <span>START SUPERVISED FINE-TUNING</span>
        </button>
      )}
      
      <div className="flex items-center justify-center gap-2 text-[10px] text-white/20 pt-2">
        <Activity size={10} />
        <span>Output will stream below in a new Notebook cell.</span>
      </div>
    </div>
  );
};
