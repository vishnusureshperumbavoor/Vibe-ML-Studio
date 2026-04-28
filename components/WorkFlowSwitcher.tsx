import React from 'react';
import { Cpu, Zap, Activity, Box } from 'lucide-react';

interface WorkFlowSwitcherProps {
  active: 'quantize' | 'finetune';
  onChange: (mode: 'quantize' | 'finetune') => void;
}

export const WorkFlowSwitcher: React.FC<WorkFlowSwitcherProps> = ({ active, onChange }) => {
  return (
    <div className="flex p-1 bg-[#121016] border border-white/5 rounded-2xl w-full max-w-md mx-auto shadow-2xl">
      <button
        onClick={() => onChange('finetune')}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300
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
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-300
          ${active === 'quantize' 
            ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/20' 
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'}
        `}
      >
        <Box size={14} />
        QUANTIZATION
      </button>
    </div>
  );
};
