import React, { useState, useEffect } from 'react';
import { Zap, Activity, Gauge, CheckCircle2, ExternalLink } from 'lucide-react';
import { SmartSelector } from './SmartSelector';
import { callKimi } from '../services/aiService';

interface FineTuningPanelProps {
  onStart: (modelId: string, datasetId: string, hardware: string, maxSteps: number, rank: number) => void;
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
}

export const FineTuningPanel: React.FC<FineTuningPanelProps> = ({ 
  onStart, 
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
  setRank
}) => {
  const [forecast, setForecast] = useState<string | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);

  useEffect(() => {
    if (preSelectedDataset) {
      setDatasetId(preSelectedDataset);
      // Clean up the pre-selection so subsequent mounts don't force it
      if (onClearSelection) onClearSelection();
    }
  }, [preSelectedDataset]);

  useEffect(() => {
    if (modelId && datasetId) {
      handleGetForecast();
    } else {
      setForecast(null);
    }
  }, [modelId, datasetId]);

  const handleGetForecast = async () => {
    setIsForecasting(true);
    setForecast(null);
    try {
      // Extract original domain from dataset name (e.g., trenser_distilled_123 -> trenser)
      const domain = datasetId.split('_distilled_')[0].replace(/_/g, ' ');

      const prompt = [
        { role: 'system', content: `You are a Senior ML Engineer at Vibe-ML Studio. Provide a predictive "Forecast" for this SFT run. 
        
        VML PLATFORM CONTEXT:
        - We use LoRA (Low-Rank Adaptation) for all runs.
        - Training is restricted to exactly 20 steps (max_steps=20) on a 500-sample dataset subset.
        - Training a 0.5B model on a modern 8-16 core CPU takes roughly 5-15 minutes.
        
        CRITICAL FEASIBILITY CHECK:
        1. Assess if the Model matches the Dataset. (Text vs Vision).
        2. Assess Model size vs Hardware. Since we use LoRA and 20 steps, Qwen-0.5B on CPU is FULLY SUPPORTED and fast.
        
        If it IS compatible, provide exactly two paragraphs:
        Paragraph 1: The narrative transformation (how this model will change after learning about "${domain}") and a HARDWARE-AWARE ESTIMATION (e.g. "Estimated Duration: ~8 mins on your CPU"). Explain how the selected Epochs and LoRA Rank will affect the depth of "${domain}" knowledge.
        Paragraph 2: 3 specific, DOMAIN-RELEVANT prompts that a user would actually ask a model trained on ${domain} knowledge. Avoid generic AI prompts like "Climate Change" or "Fantasy" unless the dataset is actually about those.` },
        { role: 'user', content: `Base Model: ${modelId}\nKnowledge Dataset: ${datasetId} (Domain: ${domain})\nHardware Target: ${hardware}\nMax Steps: ${maxSteps}\nLoRA Rank: ${rank}\nDetected System Specs: ${JSON.stringify(systemInfo)}` }
      ];
      const result = await callKimi(prompt);
      setForecast(result);
    } catch (e) {
      console.error("Forecast failed:", e);
    } finally {
      setIsForecasting(false);
    }
  };

  const RECOMMENDED_MODELS = [
    { id: 'Qwen/Qwen2-0.5B', downloads: 1250000, likes: 4500, is_cpu_ready: true },
    { id: 'HuggingFaceTB/SmolLM-135M', downloads: 850000, likes: 2200, is_cpu_ready: true },
    { id: 'microsoft/Phi-3-mini-4k-instruct', downloads: 3500000, likes: 8900, is_cpu_ready: true },
  ];

  const RECOMMENDED_DATASETS = [
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
          <p className="text-[10px] text-white/30 px-1">Tip: Tiny models like Qwen-0.5B are best for CPU.</p>
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
          <p className="text-[10px] text-white/30 px-1">Try: 'yahma/alpaca-cleaned' for general instructions.</p>
        </div>
      </div>

      <div className="space-y-8 py-4">
        {/* Max Steps Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="space-y-0.5">
              <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                Training Steps
                <Activity size={10} className={`text-amber-500/50 ${maxSteps >= 300 ? 'animate-pulse text-amber-500' : ''}`} />
              </label>
              <p className="text-[8px] text-white/20 font-medium">
                {maxSteps >= 300 ? '✨ Deployment Threshold Met (Hugging Face Auto-Upload Enabled)' : 'Total optimization iterations on the dataset.'}
              </p>
            </div>
            <div className={`text-sm font-black tabular-nums px-4 py-1.5 rounded-full border transition-all ${maxSteps >= 300 ? 'text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'text-white/40 bg-white/5 border-white/10'}`}>
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
            <span>Quick Adaptation</span>
            <span className={maxSteps >= 300 ? 'text-amber-500/40' : ''}>Autonomous Cloud Deployment (300+)</span>
            <span>Deep Knowledge Injection</span>
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

      {(isForecasting || forecast) && (
        <div className={`relative group animate-in zoom-in-95 fade-in duration-500`}>
          <div className={`absolute -inset-0.5 rounded-[28px] blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200
            ${forecast?.startsWith('⚠️') ? 'bg-red-500/40' : 'bg-gradient-to-r from-amber-500/20 to-purple-600/20'}
          `}></div>
          <div className={`relative p-6 rounded-[24px] border space-y-4
            ${forecast?.startsWith('⚠️') ? 'bg-[#150505] border-red-500/30' : 'bg-[#1A1621] border-white/10'}
          `}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${forecast?.startsWith('⚠️') ? 'text-red-400' : 'text-amber-400'}`}>
                <Gauge size={14} className={isForecasting ? "animate-spin" : ""} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {forecast?.startsWith('⚠️') ? 'Safety & Compatibility Alert' : 'VML Training Forecast'}
                </span>
              </div>
              {isForecasting && <span className="text-[8px] text-white/20 animate-pulse italic">Validating Architecture...</span>}
            </div>
            
            {isForecasting ? (
              <div className="space-y-2 py-2">
                <div className="h-2 w-3/4 bg-white/5 rounded-full animate-pulse" />
                <div className="h-2 w-1/2 bg-white/5 rounded-full animate-pulse" />
                <div className="h-2 w-2/3 bg-white/5 rounded-full animate-pulse" />
              </div>
            ) : (
              <div className={`text-[11px] leading-relaxed font-medium whitespace-pre-line prose prose-invert
                ${forecast?.startsWith('⚠️') ? 'text-red-200' : 'text-white/70'}
              `}>
                {forecast}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        disabled={!modelId || !datasetId || isExecuting}
        onClick={() => onStart(modelId, datasetId, hardware, maxSteps, rank)}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all shadow-2xl scale-100 active:scale-95
          ${!modelId || !datasetId || isExecuting 
            ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' 
            : 'bg-amber-500 text-black hover:bg-amber-400 hover:shadow-amber-500/20'}
        `}
      >
        {isExecuting ? (
          <>
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            <span>TRAINING IN PROGRESS...</span>
          </>
        ) : (
          <>
            <Zap size={18} fill="currentColor" />
            <span>START SUPERVISED FINE-TUNING</span>
          </>
        )}
      </button>
      
      <div className="flex items-center justify-center gap-2 text-[10px] text-white/20 pt-2">
        <Activity size={10} />
        <span>Output will stream below in a new Notebook cell.</span>
      </div>
    </div>
  );
};
