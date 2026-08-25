import React from 'react';
import { Cpu, Zap, Box, BarChart2, Sparkles } from 'lucide-react';

interface WorkFlowSwitcherProps {
  active: 'quantize' | 'finetune' | 'evaluate' | 'onnx' | 'vision';
  onChange: (mode: 'quantize' | 'finetune' | 'evaluate' | 'onnx' | 'vision') => void;
}

export const WorkFlowSwitcher: React.FC<WorkFlowSwitcherProps> = ({ active, onChange }) => {
  const tabs: { id: 'finetune' | 'quantize' | 'evaluate' | 'onnx' | 'vision'; label: string; icon: React.ReactNode }[] = [
    { id: 'finetune', label: 'FINE-TUNING', icon: <Zap size={14} fill={active === 'finetune' ? 'currentColor' : 'none'} /> },
    { id: 'quantize', label: 'GGUF', icon: <Box size={14} /> },
    { id: 'evaluate', label: 'EVALUATION', icon: <BarChart2 size={14} /> },
    { id: 'onnx', label: 'ONNX', icon: <Cpu size={14} /> },
    { id: 'vision', label: 'DIFFUSION', icon: <Sparkles size={14} /> },
  ];

  return (
    <div className="flex items-center p-1.5 bg-[#121016] border border-white/10 rounded-2xl w-full max-w-2xl mx-auto shadow-2xl shrink-0 z-10 gap-1">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer select-none shrink-0 ${
              isActive
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-900/30'
                : 'text-white/40 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
