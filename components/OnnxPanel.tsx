import React, { useState, useEffect } from 'react';
import { Cpu, Info, Database } from 'lucide-react';

interface OnnxPanelProps {
  onStart: (adapterSlug: string, precision: string) => void;
  isExecuting: boolean;
}

export const OnnxPanel: React.FC<OnnxPanelProps> = ({ onStart, isExecuting }) => {
  const [adapters, setAdapters] = useState<any[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState('');
  const [precision, setPrecision] = useState('FP16');
  const [loadingAdapters, setLoadingAdapters] = useState(false);

  useEffect(() => {
    const fetchAdapters = async () => {
      setLoadingAdapters(true);
      try {
        const resp = await fetch('http://127.0.0.1:2000/list_native_models');
        const data = await resp.json();
        const foundAdapters = data.models.filter((m: any) => m.type === 'adapter');
        setAdapters(foundAdapters);
        if (foundAdapters.length > 0) {
          setSelectedAdapter(foundAdapters[0].lora_slug);
        }
      } catch (e) {
        console.error('Failed to fetch adapters:', e);
      } finally {
        setLoadingAdapters(false);
      }
    };
    fetchAdapters();
  }, []);

  const precisionOptions = [
    { id: 'FP32', label: 'FP32 (Lossless)', desc: 'Full precision. Largest file size.' },
    { id: 'FP16', label: 'FP16 (Half)', desc: 'Standard for GPUs. 50% smaller.' },
    { id: 'INT8', label: 'INT8 (Quantized)', desc: 'Best for CPUs. 75% smaller.' },
    { id: 'INT4', label: 'INT4 (Block)', desc: 'Smallest size. Experimental.' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Target Fine-tuned Model (Adapter)</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-amber-500 transition-colors">
            <Database size={16} />
          </div>
          <select
            value={selectedAdapter}
            onChange={(e) => setSelectedAdapter(e.target.value)}
            disabled={loadingAdapters || isExecuting}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all appearance-none cursor-pointer"
          >
            {loadingAdapters ? (
              <option>Loading adapters...</option>
            ) : adapters.length === 0 ? (
              <option>No adapters found in server/models/adapters</option>
            ) : (
              adapters.map((a) => (
                <option key={a.lora_slug} value={a.lora_slug}>
                  {a.lora_slug}
                </option>
              ))
            )}
          </select>
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-white/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Export Precision</label>
        <div className="grid grid-cols-2 gap-2">
          {precisionOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPrecision(opt.id)}
              disabled={isExecuting}
              className={`flex flex-col items-start gap-1 p-4 rounded-2xl border transition-all text-left group
                ${precision === opt.id 
                  ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/20' 
                  : 'bg-white/5 border-white/5 hover:border-white/10'}
              `}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${precision === opt.id ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-white/20'}`} />
                <div className={`text-xs font-bold transition-colors ${precision === opt.id ? 'text-amber-400' : 'text-white'}`}>
                  {opt.id}
                </div>
              </div>
              <div className="text-[9px] text-white/40 leading-tight">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex gap-3">
        <div className="flex-none mt-0.5">
          <Info size={14} className="text-amber-400" />
        </div>
        <p className="text-[10px] text-amber-400/80 leading-relaxed">
          The system will automatically merge the adapter with its base model before exporting to ONNX. The process will be visible in the Studio tab.
        </p>
      </div>

      <button
        disabled={!selectedAdapter || isExecuting}
        onClick={() => onStart(selectedAdapter, precision)}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all shadow-2xl scale-100 active:scale-95
          ${!selectedAdapter || isExecuting 
            ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' 
            : 'bg-white text-black hover:bg-neutral-200 hover:shadow-white/10'}
        `}
      >
        {isExecuting ? (
          <>
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            <span>EXPORTING...</span>
          </>
        ) : (
          <>
            <Cpu size={18} />
            <span>PRODUCE ONNX MODEL</span>
          </>
        )}
      </button>
    </div>
  );
};
