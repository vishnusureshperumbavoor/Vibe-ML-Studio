import React, { useState } from 'react';
import { Box, Play, AlertCircle, Info } from 'lucide-react';
import { SmartSelector } from './SmartSelector';

interface QuantizationPanelProps {
  onStart: (modelId: string, bits: string) => void;
  isExecuting: boolean;
}

export const QuantizationPanel: React.FC<QuantizationPanelProps> = ({ onStart, isExecuting }) => {
  const [modelId, setModelId] = useState('');
  const [bits, setBits] = useState('4');

  const modelSuggestions = [
    { id: 'Qwen/Qwen2.5-1.5B', downloads: 850000, likes: 1200, is_cpu_ready: true },
    { id: 'Qwen/Qwen2.5-0.5B', downloads: 450000, likes: 800, is_cpu_ready: true },
    { id: 'meta-llama/Llama-3.2-3B', downloads: 1200000, likes: 2500, is_cpu_ready: true },
  ];

  const bitOptions = [
    { label: '4-bit (Fastest)', value: '4', desc: 'Best for 8GB-16GB RAM. Minimal loss.' },
    { label: '8-bit (Balanced)', value: '8', desc: 'Better quality, requires 16GB-32GB RAM.' },
    { label: '16-bit (Lossless)', value: '16', desc: 'No compression. Full weights.' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Target Model</label>
        <SmartSelector 
          type="model" 
          placeholder="Search Hugging Face models (e.g., Qwen2)..." 
          onSelect={setModelId} 
          suggestions={modelSuggestions}
        />
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Quantization Level</label>
        <div className="grid grid-cols-1 gap-2">
          {bitOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setBits(opt.value)}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group
                ${bits === opt.value 
                  ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/20' 
                  : 'bg-white/5 border-white/5 hover:border-white/10'}
              `}
            >
              <div className={`mt-1 flex-none w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all
                ${bits === opt.value ? 'border-amber-500' : 'border-white/20'}
              `}>
                {bits === opt.value && <div className="w-2 h-2 rounded-full bg-amber-500 animate-in zoom-in duration-200" />}
              </div>
              <div className="flex-1">
                <div className={`text-xs font-bold transition-colors ${bits === opt.value ? 'text-amber-400' : 'text-white'}`}>
                  {opt.label}
                </div>
                <div className="text-[10px] text-white/40 mt-0.5">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex gap-3">
        <div className="flex-none mt-0.5">
          <Info size={14} className="text-blue-400" />
        </div>
        <p className="text-[10px] text-blue-400/80 leading-relaxed">
          Quantization compresses models to run on consumer hardware. We use GGUF format for optimal local performance.
        </p>
      </div>

      <button
        disabled={!modelId || isExecuting}
        onClick={() => onStart(modelId, bits)}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all shadow-2xl scale-100 active:scale-95
          ${!modelId || isExecuting 
            ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' 
            : 'bg-white text-black hover:bg-neutral-200 hover:shadow-white/10'}
        `}
      >
        {isExecuting ? (
          <>
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            <span>QUANTIZING...</span>
          </>
        ) : (
          <>
            <Box size={18} />
            <span>GENERATE QUANTIZED MODEL</span>
          </>
        )}
      </button>
    </div>
  );
};
