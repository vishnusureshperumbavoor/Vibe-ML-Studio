import React, { useState } from 'react';
import { AlertCircle, Wand2, CheckCircle2, Copy, Terminal, Activity, Layout } from 'lucide-react';
import { ExecutionStatus } from '../types';
import { RenderedImage } from './RenderedImage';
import { ProgressBar } from './ProgressBar';
import { HuggingFaceAuth } from './HuggingFaceAuth';
import { PlotView } from './PlotView';

interface CellOutputProps {
  output?: string;
  status: ExecutionStatus;
  executionCount?: number;
  type: 'code' | 'markdown' | 'query';
  plots?: any[];
  onOpenArena?: (modelId: string) => void;
  metadata?: Record<string, any>;
}

export const CellOutput: React.FC<CellOutputProps> = ({ output, status, type, plots, onOpenArena, metadata }) => {
  const [wasCopied, setWasCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'insights'>('console');

  if (type === 'markdown') return null; 

  const handleCopy = () => {
      if (output) {
          navigator.clipboard.writeText(output);
          setWasCopied(true);
          setTimeout(() => setWasCopied(false), 2000);
      }
  };

  const hasPlots = plots && plots.length > 0;


  // Pattern to identify tqdm-style progress bars: "Label: 40%|...| 117/290 [stats]"
  const PROGRESS_BAR_REGEX = /^\s*(?:(.*?):\s*)?(\d+)%\|.*?\|\s*(\d+)\/(\d+)\s*\[(.*?)\]/;

  const lines = output?.split('\n') || [];
  
  // Find the last occurrence of each progress bar label to avoid duplicate bars
  const latestProgressIndices = new Map<string, number>();
  lines.forEach((line, i) => {
      const match = line.match(PROGRESS_BAR_REGEX);
      if (match) {
          const label = match[1] || 'Downloading';
          latestProgressIndices.set(label, i);
      }
  });

  if (!output && !hasPlots && status !== 'error' && status !== 'fixing') return null;

  return (
    <div className="mt-4 w-full animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Output Header / Tabs */}
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all
              ${activeTab === 'console' ? 'text-white' : 'text-white/20 hover:text-white/40'}
            `}
          >
            <Terminal size={10} /> Console Output
          </button>
          {hasPlots && (
            <button 
              onClick={() => setActiveTab('insights')}
              className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all
                ${activeTab === 'insights' ? 'text-white' : 'text-white/20 hover:text-white/40'}
              `}
            >
              <Activity size={10} className="text-amber-500" /> VML Insights
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
            {output && (
                <button 
                  onClick={handleCopy}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider transition-all
                    ${wasCopied ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}
                  `}
                >
                  <Copy size={10} />
                  {wasCopied ? 'Copied' : 'Copy Console'}
                </button>
            )}
        </div>
      </div>

      {/* Auto-Fixing Banner */}
      {status === 'fixing' && (
          <div className="mb-2 bg-purple-900/20 border-l-2 border-purple-500 p-2 text-purple-200 text-sm font-mono flex items-center gap-2 rounded-r-sm animate-pulse">
              <Wand2 size={14} />
              <span>Auto-Fixing detected error...</span>
          </div>
      )}

      {/* Main Output Display */}
      <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        {activeTab === 'insights' && hasPlots ? (
          <div className="p-6">
            <PlotView data={plots} onOpenArena={onOpenArena} metadata={metadata} />
          </div>
        ) : (
          <div className="p-4 relative group/output">
            {/* Error Output */}
            {status === 'error' || (status === 'fixing' && output) ? (
               <div className="text-red-200 font-mono text-xs md:text-sm whitespace-pre-wrap overflow-x-auto">
                  <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-wider text-[10px]">
                          <AlertCircle size={12} />
                          <span>Runtime Traceback</span>
                      </div>
                      <button 
                          onClick={handleCopy}
                          className="text-[10px] px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      >
                          {wasCopied ? 'COPIED!' : 'COPY ERROR LOG'}
                      </button>
                  </div>
                  {output}
               </div>
            ) : (
                // Standard Output
                <div className="font-mono text-[11px] leading-relaxed text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-[500px] custom-scrollbar">
                    {lines.map((line, i) => {
                        const imgMatch = line.match(/\[IMAGE:\s*(.*?)\]/);
                        if (imgMatch) return <RenderedImage key={i} source={imgMatch[1].trim()} />;
                        
                        const progressMatch = line.match(PROGRESS_BAR_REGEX);
                        if (progressMatch) {
                            const label = progressMatch[1] || 'Downloading';
                            // Only show the most recent progress bar for this label
                            if (latestProgressIndices.get(label) !== i) return null;

                            return (
                                <ProgressBar 
                                    key={i} 
                                    label={label} 
                                    percentage={progressMatch[2]} 
                                    current={progressMatch[3]} 
                                    total={progressMatch[4]} 
                                    stats={progressMatch[5]} 
                                />
                            );
                        }

                        if (line.includes("Warning: You are sending unauthenticated requests to the HF Hub")) {
                           return <HuggingFaceAuth key={i} envKey="HF_TOKEN" placeholder="hf_..." />;
                        }

                        // Hide progress-bar noise like "Loading weights" if it's on a separate line
                        const isNoise = line.trim() === "Loading weights" || line.includes("Loading weights...") || line.includes("Using pad_token");
                        if (isNoise) return null;

                        return <div key={i} className={line.includes('Loading weights') ? 'hidden' : ''}>{line}</div>;
                    })}
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};