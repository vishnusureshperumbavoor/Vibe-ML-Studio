import React from 'react';
import { Zap, Terminal } from 'lucide-react';

interface WorkFlowSwitcherProps {
  active: 'finetune' | 'studio';
  onChange: (mode: 'finetune' | 'studio') => void;
}

export const WorkFlowSwitcher: React.FC<WorkFlowSwitcherProps> = ({ active, onChange }) => {
  const tabs: { id: 'finetune' | 'studio'; label: string; icon: React.ReactNode }[] = [
    { id: 'finetune', label: 'FINE-TUNING', icon: <Zap size={14} fill={active === 'finetune' ? 'currentColor' : 'none'} /> },
    { id: 'studio', label: 'STUDIO NOTEBOOK', icon: <Terminal size={14} /> },
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
