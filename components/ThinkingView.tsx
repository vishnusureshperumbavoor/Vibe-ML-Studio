import React, { useState } from 'react';
import { Brain, Sparkles, Copy, Check } from 'lucide-react';

interface ThinkingViewProps {
  content: string | null;
  isVisible: boolean;
  history?: string[];
  onClose: () => void;
}

export const ThinkingView: React.FC<ThinkingViewProps> = ({ content, isVisible, history = [], onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  if (!isVisible || !content) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
        onClose();
        setIsClosing(false);
    }, 200);
  };

  const handleCopy = () => {
      const fullHistory = history.length > 0 
          ? history.join('\n\n---\n\n') 
          : content;
      navigator.clipboard.writeText(fullHistory);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`fixed top-20 right-8 w-80 max-h-[60vh] z-50 transition-all duration-300 ${isClosing ? 'opacity-0 scale-95 translate-x-4' : 'animate-in fade-in slide-in-from-right-4'}`}>
      <div className="bg-[#1D152A]/80 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-purple-500/10 px-4 py-3 border-b border-purple-500/20 flex items-center gap-3">
          <div className="p-1.5 bg-purple-500/20 rounded-lg">
            <Brain className="text-purple-400" size={16} />
          </div>
          <span className="text-xs font-semibold text-purple-200 tracking-wider uppercase">Agent Reasoning</span>
          <div className="flex-grow"></div>
          <div className="flex gap-1">
            <button 
              onClick={handleCopy}
              className="p-1.5 hover:bg-purple-500/20 rounded-md transition-colors text-purple-400"
              title="Copy Thinking History"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button 
              onClick={handleClose}
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-y-auto custom-scrollbar">
          <p className="text-sm text-[#E2D8F0]/80 leading-relaxed italic font-light">
            "{content}"
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-black/20 flex items-center justify-between">
           <span className="text-[10px] text-purple-400/60 font-mono">VML Agent Reasoning</span>
           <Sparkles className="text-purple-500/40" size={10} />
        </div>
      </div>
    </div>
  );
};
