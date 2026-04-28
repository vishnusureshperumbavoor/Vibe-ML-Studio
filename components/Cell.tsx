import React, { useState } from 'react';
import { Play, Copy, Wand2, CheckCircle2, Loader2, XCircle, Zap, Rocket, Terminal, Activity, Layout } from 'lucide-react';
import { CellData } from '../types';
import { EditorArea } from './EditorArea';
import { CellOutput } from './CellOutput';
import { PlotView } from './PlotView';
import ReactMarkdown from 'react-markdown';

interface CellProps {
  cell: CellData;
  isActive: boolean;
  onFocus: () => void;
  onChange: (id: string, content: string) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onTypeChange: (id: string, type: 'code' | 'markdown') => void;
  onOpenArena?: (modelId: string) => void;
  metadata?: Record<string, any>;
}

export const Cell: React.FC<CellProps> = ({
  cell,
  isActive,
  onFocus,
  onChange,
  onRun,
  onDelete,
  onMoveUp,
  onMoveDown,
  onTypeChange,
  onOpenArena,
  metadata
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [wasCopied, setWasCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    let textToCopy = `### CELL CODE\n\`\`\`python\n${cell.content}\n\`\`\``;
    
    if (cell.output) {
      textToCopy += `\n\n### CELL OUTPUT (Status: ${cell.status})\n\`\`\`text\n${cell.output}\n\`\`\``;
    }

    navigator.clipboard.writeText(textToCopy);
    setWasCopied(true);
    setTimeout(() => setWasCopied(false), 2000);
  };

  const handleRun = () => {
    if (cell.type === 'markdown') {
        setShowPreview(true);
    } else {
        onRun(cell.id);
    }
  };

  const handleDoubleClickMarkdown = () => {
      if (cell.type === 'markdown') {
          setShowPreview(false);
      }
  };

  const getContainerStyles = () => {
      const base = "group relative flex flex-col mb-4 p-2 rounded border border-transparent transition-all duration-300";
      if (cell.status === 'running') return `${base} border-purple-500/60 bg-[#1D152A] shadow-sm`;
      if (cell.status === 'fixing' || cell.status === 'recovering') return `${base} border-fuchsia-500/60 bg-fuchsia-900/10 shadow-sm`;
      if (cell.status === 'error') return `${base} border-red-500/40 bg-red-900/10`;
      if (cell.status === 'success') return `${base} border-emerald-500/30 bg-[#1D152A]`;
      if (isActive) return `${base} border-purple-800 bg-[#1D152A] shadow-md`;
      return `${base} border-transparent hover:border-[#352554] hover:bg-[#1A1224]`;
  };

  if (cell.type === 'query') {
      return (
          <div className="bg-[#1A1127] border border-[#352554] rounded-xl p-3 mb-6 shadow-lg relative overflow-hidden flex items-center gap-3">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50"></div>
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <Rocket className="text-indigo-400" size={16} />
              </div>
              <div className="flex-1">
                  <p className="text-sm font-medium text-[#E2D8F0]/90 leading-tight">
                      {cell.content}
                  </p>
              </div>
              <button
                  onClick={handleCopy}
                  className={`p-1.5 rounded flex items-center gap-1.5 text-[10px] font-bold transition-all duration-200
                      ${wasCopied ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}
                  `}
                  title="Copy query"
              >
                  {wasCopied ? (
                      <>
                          <CheckCircle2 size={12} />
                          <span>COPIED!</span>
                      </>
                  ) : (
                      <>
                          <Copy size={12} />
                          <span>COPY</span>
                      </>
                  )}
              </button>
          </div>
      );
  }

  return (
    <div 
      className={getContainerStyles()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onFocus}
    >
      <div className="flex flex-row w-full gap-3">
        <div className="flex-none w-8 pt-1.5 flex flex-col items-center">
            {cell.type === 'code' ? (
                <>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleRun(); }}
                        className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center relative group/btn
                            ${cell.status === 'running' || cell.status === 'fixing' || cell.status === 'recovering' ? 'cursor-not-allowed opacity-100' : 'hover:bg-[#352554] cursor-pointer'}
                        `}
                        disabled={cell.status === 'running' || cell.status === 'fixing' || cell.status === 'recovering'}
                    >
                        {cell.status === 'running' ? (
                           <Loader2 size={18} className="animate-spin text-indigo-400" />
                        ) : cell.status === 'fixing' || cell.status === 'recovering' ? (
                            <div className="relative">
                                <Wand2 size={18} className="animate-pulse text-purple-400" />
                                {cell.status === 'recovering' && (
                                    <Zap size={10} className="absolute -top-1 -right-1 text-yellow-400 animate-bounce" />
                                )}
                            </div>
                        ) : cell.status === 'success' ? (
                            <>
                                <CheckCircle2 size={18} className="text-emerald-500 transition-opacity absolute duration-200 group-hover/btn:opacity-0" />
                                <Play size={18} className="text-[#9480B3] opacity-0 group-hover/btn:opacity-100 transition-opacity absolute" fill="currentColor" />
                                <div className="w-4 h-4" /> 
                            </>
                        ) : cell.status === 'error' ? (
                            <>
                                <XCircle size={18} className="text-red-500 transition-opacity absolute duration-200 group-hover/btn:opacity-0" />
                                <Play size={18} className="text-[#9480B3] opacity-0 group-hover/btn:opacity-100 transition-opacity absolute" fill="currentColor" />
                                <div className="w-4 h-4" />
                            </>
                        ) : (
                           <Play size={18} className="text-[#9480B3] hover:text-white transition-colors" fill="currentColor" />
                        )}
                    </button>
                    <span className="text-xs font-mono text-purple-400 mt-1 select-none whitespace-nowrap">
                        In [{cell.executionCount || ' '}]:
                    </span>
                </>
            ) : null}
        </div>

        <div className="flex-grow min-w-0">
            {cell.type === 'markdown' && showPreview && cell.content.trim() !== '' ? (
                 <div 
                    className="prose prose-invert prose-sm max-w-none p-4 cursor-text border border-transparent hover:bg-[#252526] rounded-md transition-colors"
                    onDoubleClick={handleDoubleClickMarkdown}
                 >
                    <ReactMarkdown>{cell.content}</ReactMarkdown>
                 </div>
            ) : (
                <EditorArea
                    value={cell.content}
                    onChange={(val) => onChange(cell.id, val)}
                    language={cell.type === 'code' ? 'python' : 'markdown'}
                    onRun={handleRun}
                    placeholder={cell.type === 'code' ? 'print("Hello World")' : '## Markdown Title...'}
                    readOnly={cell.status === 'running' || cell.status === 'fixing'}
                />
            )}

            {cell.type === 'code' && (
                <CellOutput 
                    output={cell.output} 
                    status={cell.status} 
                    type={cell.type}
                    plots={cell.plots}
                    onOpenArena={onOpenArena}
                    metadata={metadata}
                />
            )}
        </div>
      </div>

      {/* Floating Action Menu (Simplified: Copy only) */}
      <div className={`absolute -top-3 right-4 flex items-center gap-1 bg-[#1D152A] shadow-xl border border-[#352554] rounded-lg px-2 py-1 transition-all duration-200 z-10 ${isActive || isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <button 
            onClick={handleCopy} 
            className={`p-1.5 rounded flex items-center gap-1.5 text-[10px] font-bold transition-all duration-200
                ${wasCopied ? 'text-emerald-400 bg-emerald-500/10' : 
                  cell.status === 'error' ? 'text-red-400 hover:text-white hover:bg-red-500/20' :
                  'text-gray-400 hover:text-white hover:bg-white/10'}
            `} 
            title="Copy Content"
        >
            {wasCopied ? (
                <>
                    <CheckCircle2 size={12} />
                    <span>COPIED!</span>
                </>
            ) : (
                <>
                    <Copy size={12} />
                    <span>COPY</span>
                </>
            )}
        </button>
      </div>
    </div>
  );
};
