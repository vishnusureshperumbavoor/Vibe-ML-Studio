import React from 'react';

interface ProgressBarProps {
  label: string;
  percentage: string;
  current: string;
  total: string;
  stats: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ label, percentage, current, total, stats }) => {
  return (
    <div className="my-3 max-w-xl bg-[#140F1D] border border-purple-500/30 p-4 rounded-xl shadow-lg animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">{label || 'Optimizing'}</span>
            <span className="text-xs font-mono text-purple-400">{percentage}%</span>
        </div>
        <div className="h-2 w-full bg-[#0B090F] rounded-full overflow-hidden border border-purple-500/20">
            <div 
                className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 transition-all duration-500" 
                style={{ width: `${percentage}%` }}
            />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-gray-500">
            <span>{current} / {total} units</span>
            <span>{stats}</span>
        </div>
    </div>
  );
};
