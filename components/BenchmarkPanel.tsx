import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Play, Loader2 } from 'lucide-react';

interface BenchmarkPanelProps {
  systemInfo?: any;
}

export const BenchmarkPanel: React.FC<BenchmarkPanelProps> = ({ systemInfo: _systemInfo }) => {
  const [dataset, setDataset] = useState('gsm8k');
  const [modelId, setModelId] = useState('');
  const [loraSlug, setLoraSlug] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  
  const [nativeModels, setNativeModels] = useState<any[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const resp = await fetch("http://127.0.0.1:2000/list_native_models");
        const data = await resp.json();
        setNativeModels(data.models || []);
      } catch (e) {
        console.error("Failed to fetch native models:", e);
      }
    };
    fetchModels();
  }, []);
  
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [benchmarkStatus, setBenchmarkStatus] = useState<any>(null);

  useEffect(() => {
    let interval: any;
    if (isBenchmarking) {
      interval = setInterval(async () => {
        try {
          const resp = await fetch("http://127.0.0.1:2000/benchmark/status");
          const status = await resp.json();
          setBenchmarkStatus(status);
        } catch (e) {
          console.error("Failed to fetch benchmark status", e);
        }
      }, 1000);
    } else {
      setBenchmarkStatus(null);
    }
    return () => clearInterval(interval);
  }, [isBenchmarking]);

  const handleStartBenchmark = async () => {
    if (!modelId) return;
    setIsBenchmarking(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("http://127.0.0.1:2000/benchmark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          model_filename: modelId,
          lora_slug: loraSlug || undefined,
          num_questions: numQuestions
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Benchmark failed');
      }
      
      setResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBenchmarking(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Benchmark Dataset</label>
          <div className="flex gap-2">
            {['gsm8k', 'mmlu'].map((ds) => (
              <button
                key={ds}
                onClick={() => setDataset(ds)}
                className={`flex-1 p-3 rounded-xl border text-xs font-bold transition-all uppercase
                  ${dataset === ds 
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' 
                    : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'}
                `}
              >
                {ds} {ds === 'gsm8k' ? '🧮' : '📚'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/30 px-1">GSM8K: Grade School Math. MMLU: General Knowledge.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Base Model</label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full bg-[#0B090F] border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all shadow-inner appearance-none cursor-pointer"
          >
            <option value="" disabled>Select model to evaluate...</option>
            {nativeModels.filter(m => m.type === 'base').map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Adapter (Optional LoRA Slug)</label>
          <select
            value={loraSlug}
            onChange={(e) => setLoraSlug(e.target.value)}
            className="w-full bg-[#0B090F] border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all shadow-inner appearance-none cursor-pointer"
          >
            <option value="">None (Base Model Only)</option>
            {nativeModels.filter(m => m.type === 'adapter').map((m) => (
              <option key={m.lora_slug} value={m.lora_slug}>{m.lora_slug}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
              Number of Questions
            </label>
            <div className="text-sm font-black text-amber-500 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20">
              {numQuestions}
            </div>
          </div>
          <input
            type="range"
            min="2"
            max="100"
            step="1"
            value={numQuestions}
            onChange={(e) => setNumQuestions(parseInt(e.target.value))}
            className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all border border-white/5"
          />
        </div>
      </div>

      <button
        disabled={!modelId || isBenchmarking}
        onClick={handleStartBenchmark}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all shadow-2xl scale-100 active:scale-95
          ${!modelId || isBenchmarking 
            ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' 
            : 'bg-amber-500 text-black hover:bg-amber-400 hover:shadow-amber-500/20'}
        `}
      >
        {isBenchmarking ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>RUNNING EVALUATION...</span>
          </>
        ) : (
          <>
            <Play size={18} fill="currentColor" />
            <span>RUN BENCHMARK</span>
          </>
        )}
      </button>

      {isBenchmarking && benchmarkStatus && benchmarkStatus.step === 'running' && (
        <div className="p-6 bg-[#1A1621] border border-amber-500/20 rounded-3xl space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-white/60">
            <span className="truncate pr-4">{benchmarkStatus.current_task}</span>
            <span className="text-amber-500 shrink-0">
              {Math.round((benchmarkStatus.progress / (benchmarkStatus.total || 1)) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500 ease-out"
              style={{ width: `${(benchmarkStatus.progress / (benchmarkStatus.total || 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm font-medium">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-6 animate-in zoom-in-95 duration-500">
          <div className="p-8 bg-[#1A1621] border border-white/10 rounded-3xl text-center space-y-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />
            <h3 className="text-lg font-bold text-white/40 uppercase tracking-widest">Accuracy Score</h3>
            <div className="text-6xl font-black text-amber-400">
              {(results.accuracy * 100).toFixed(1)}%
            </div>
            <p className="text-sm font-bold text-emerald-400">
              {results.correct} / {results.total} correct
            </p>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            <h4 className="text-sm font-bold text-white/60 uppercase tracking-widest">Detailed Results</h4>
            {results.details.map((res: any, idx: number) => (
              <div key={idx} className={`p-4 rounded-2xl border ${res.is_correct ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-start gap-3">
                  {res.is_correct ? <CheckCircle2 size={18} className="text-emerald-500 mt-1 flex-shrink-0" /> : <XCircle size={18} className="text-red-500 mt-1 flex-shrink-0" />}
                  <div className="space-y-2 w-full">
                    <p className="text-sm text-white/80 leading-relaxed font-medium">{res.question}</p>
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wide">
                      <span className="text-white/40">Expected: <span className="text-white">{res.expected}</span></span>
                      <span className="text-white/40">Predicted: <span className={res.is_correct ? 'text-emerald-400' : 'text-red-400'}>{res.predicted}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
