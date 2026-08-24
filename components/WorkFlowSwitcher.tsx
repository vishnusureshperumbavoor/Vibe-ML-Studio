import React from 'react';
import { Cpu, Zap, Box, BarChart2, Sparkles } from 'lucide-react';

interface WorkFlowSwitcherProps {
  active: 'quantize' | 'finetune' | 'evaluate' | 'onnx' | 'vision';
  onChange: (mode: 'quantize' | 'finetune' | 'evaluate' | 'onnx' | 'vision') => void;
}

export const WorkFlowSwitcher: React.FC<WorkFlowSwitcherProps> = ({ active, onChange }) => {
  return (
    <div className="flex p-1 bg-[#121016] border border-white/5 rounded-2xl w-full max-w-2xl mx-auto shadow-2xl overflow-x-auto">
      <button
        onClick={() => onChange('finetune')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all duration-300 shrink-0
          ${active === 'finetune' 
            ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/20' 
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'}
        `}
      >
        <Zap size={14} fill={active === 'finetune' ? 'currentColor' : 'none'} />
        FINE-TUNING
      </button>
      <button
        onClick={() => onChange('quantize')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all duration-300 shrink-0
          ${active === 'quantize' 
            ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/20' 
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'}
        `}
      >
        <Box size={14} />
        GGUF
      </button>
      <button
        onClick={() => onChange('evaluate')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all duration-300 shrink-0
          ${active === 'evaluate' 
            ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/20' 
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'}
        `}
      >
        <BarChart2 size={14} />
        EVALUATION
      </button>
      <button
        onClick={() => onChange('onnx')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all duration-300 shrink-0
          ${active === 'onnx' 
            ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/20' 
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'}
        `}
      >
        <Cpu size={14} />
        ONNX
      </button>
      <button
        onClick={() => onChange('vision')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all duration-300 shrink-0
          ${active === 'vision' 
            ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/20' 
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'}
        `}
      >
        <Sparkles size={14} />
        DIFFUSION
      </button>
    </div>
  );
};
