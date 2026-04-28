import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, Loader2, Cpu, Lock, Star, Download, Database } from 'lucide-react';

interface ModelResult {
  id: string;
  downloads: number;
  likes: number;
  gated: boolean;
  is_cpu_ready: boolean;
  is_local?: boolean;
  size_kb?: number;
}

interface SmartSelectorProps {
  type: 'model' | 'dataset';
  onSelect: (id: string) => void;
  placeholder: string;
  defaultValue?: string;
  suggestions?: any[];
}

export const SmartSelector: React.FC<SmartSelectorProps> = ({ type, onSelect, placeholder, defaultValue, suggestions }) => {
  const [query, setQuery] = useState(defaultValue || '');
  const [results, setResults] = useState<any[]>([]);
  const [localData, setLocalData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch local data on mount for fast search
  useEffect(() => {
    const fetchLocal = async () => {
      try {
        const endpoint = type === 'model' ? "/list_local_base_models" : "/list_local_datasets";
        const resp = await fetch(`http://127.0.0.1:2000${endpoint}`);
        const data = await resp.json();
        setLocalData(data.models || data.datasets || []);
      } catch (e) {
        console.error("Local fetch failed:", e);
      }
    };
    fetchLocal();
  }, [type]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const skipSearchRef = useRef(false);

  const search = async (q: string) => {
    if (!q || q.length < 2) return;
    setIsLoading(true);
    
    try {
      // 1. Search Local First
      const localMatches = localData.filter(d => 
        d.id.toLowerCase().includes(q.toLowerCase()) || 
        (d.display_name && d.display_name.toLowerCase().includes(q.toLowerCase()))
      ).map(d => ({...d, is_local: true}));

      // 2. Search Remote via MCP
      const toolName = type === 'model' ? 'model_search' : 'dataset_search';
      const mcpUrl = "http://127.0.0.1:1001/mcp/call"; 
      
      const resp = await fetch(mcpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: toolName,
          arguments: { query: q, limit: 10 }
        })
      });
      
      const payload = await resp.json();
      const content = payload.result || payload; 
      
      let remoteResults: any[] = [];
      if (content && content[0] && content[0].text) {
        let text = content[0].text;
        
        if (text.includes("[JSON_RESULTS]")) {
          const jsonStr = text.split("[JSON_RESULTS]")[1].trim();
          remoteResults = JSON.parse(jsonStr);
        } else {
          const regex = /-\s+\*\*(.*?)\*\*\s+\(Downloads:\s+(.*?)\)/g;
          let m;
          while ((m = regex.exec(text)) !== null) {
            remoteResults.push({
              id: m[1],
              downloads: parseInt(m[2].replace(/,/g, '')),
              likes: 0,
              gated: false,
              is_cpu_ready: m[1].toLowerCase().includes('0.5b') || m[1].toLowerCase().includes('360m')
            });
          }
        }
      }

      // Merge and unique-ify (prefer local if ID matches)
      // For models, we compare normalized IDs
      const combined = [...localMatches];
      remoteResults.forEach(rem => {
        const isAlreadyIn = combined.some(loc => 
            loc.id.toLowerCase() === rem.id.toLowerCase() || 
            loc.id.replace('_', '/').toLowerCase() === rem.id.toLowerCase()
        );
        if (!isAlreadyIn) {
          combined.push(rem);
        }
      });
      
      setResults(combined);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Update query if defaultValue changes externally
  useEffect(() => {
    if (defaultValue !== undefined) {
        setQuery(defaultValue);
        skipSearchRef.current = true;
    }
  }, [defaultValue]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (skipSearchRef.current) {
        skipSearchRef.current = false;
        return;
      }
      if (query && query !== defaultValue) search(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Merge suggestions with any local matches
  const displayResults = query.length < 2 
    ? [...(localData.map(d => ({...d, is_local: true}))), ...(suggestions || [])].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
    : results;
    
  const isShowingSuggestions = query.length < 2;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40 group-focus-within:text-amber-500 transition-colors">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-[#0B090F] border border-white/10 rounded-2xl pl-10 pr-10 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/5 transition-all shadow-inner"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-white/20">
          {isLoading ? <Loader2 size={16} className="animate-spin text-amber-500" /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isOpen && (displayResults.length > 0 || isLoading) && (
        <div className="absolute z-50 w-full mt-2 bg-[#121016] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 space-y-1">
            {isShowingSuggestions && (
              <div className="px-3 py-2 text-[10px] font-black text-amber-500/50 uppercase tracking-[0.2em] border-b border-white/5 mb-2 flex items-center gap-2">
                <Star size={10} fill="currentColor" /> Quick Suggestions
              </div>
            )}
            
            {displayResults.map((res) => (
              <button
                key={res.id}
                onClick={() => {
                  skipSearchRef.current = true;
                  const cleanName = res.is_local && type === 'dataset' ? res.id.replace('.jsonl', '') : res.id;
                  setQuery(cleanName);
                  onSelect(res.id);
                  setIsOpen(false);
                  setResults([]);
                }}
                className="w-full flex flex-col items-start p-3 rounded-xl hover:bg-white/5 transition-all text-left group border border-transparent hover:border-white/10"
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                    {res.is_local && type === 'dataset' ? res.id.replace('.jsonl', '') : res.id}
                  </span>
                  <div className="flex items-center gap-1.5 flex-none text-[10px] font-bold">
                    {res.is_local && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                        <Database size={10} /> LOCAL
                      </span>
                    )}
                    {res.is_cpu_ready && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Cpu size={10} /> CPU READY
                      </span>
                    )}
                    {res.gated && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lock size={10} /> GATED
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mt-2 text-[10px] text-white/40 font-medium">
                  {res.is_local ? (
                    <span className="flex items-center gap-1 text-emerald-400/60 uppercase">
                      Local {type === 'model' ? 'Base Model' : 'Dataset'} {res.size_kb ? `• ${res.size_kb > 1024 ? `${(res.size_kb/1024).toFixed(1)} MB` : `${res.size_kb} KB`}` : ''}
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <Download size={10} /> {res.downloads.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star size={10} /> {res.likes.toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
              </button>
            ))}
            {!isLoading && results.length === 0 && query.length >= 2 && (
              <div className="p-4 text-center text-xs text-white/20 italic">
                No matching {type}s found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
