import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  Globe, 
  FileText, 
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  Sparkles,
  Share2,
  ExternalLink,
  Activity,
  Brain
} from 'lucide-react';
import { Button } from './Button';

export function KnowledgeLibrary({ onDistillComplete, distillStatus, setDistillStatus, showDistillUI, setShowDistillUI }: { 
  onDistillComplete?: (datasetId: string) => void,
  distillStatus: any,
  setDistillStatus: (s: any) => void,
  showDistillUI: boolean,
  setShowDistillUI: (v: boolean) => void
}) {
  const [collections, setCollections] = useState<any[]>([]);
  const [totalStorage, setTotalStorage] = useState<number>(0);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<any[]>([]);
  const [isExploring, setIsExploring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const handleCopyBlock = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [isMining, setIsMining] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [miningStep, setMiningStep] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [sourceHistory, setSourceHistory] = useState<string[]>([]);
  const [sourceInput, setSourceInput] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const newNameRef = React.useRef<HTMLInputElement>(null);
  const [localDatasets, setLocalDatasets] = useState<any[]>([]);
  // Persistent state now passed as props
  const [distillPersona, setDistillPersona] = useState('Generic');


  const fetchLocalDatasets = async () => {
    try {
      const resp = await fetch("http://127.0.0.1:2000/list_local_datasets");
      const data = await resp.json();
      setLocalDatasets(data.datasets || []);
    } catch (e) {
      console.error("Failed to fetch local datasets:", e);
    }
  };

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch("http://127.0.0.1:1001/mcp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "list_knowledge_collections", arguments: {} })
      });
      const data = await resp.json();
      const text = data[0]?.text || data.result?.[0]?.text || "";
      if (text.includes("[JSON_RESULTS]")) {
        const jsonStr = text.split("[JSON_RESULTS]")[1].trim();
        const results = JSON.parse(jsonStr);
        setCollections(results.collections || []);
        setTotalStorage(results.total_storage_mb || 0);
      }
    } catch (e) {
      console.error("Failed to fetch collections:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
    fetchLocalDatasets();
    
    // Check if distillation is already running in background
    const checkStatus = async () => {
      try {
        const resp = await fetch("http://127.0.0.1:2000/distill/status");
        const status = await resp.json();
        if (status.step !== 'idle') {
          setDistillStatus(status);
          setShowDistillUI(true);
        }
      } catch (e) {
        console.error("Failed to fetch initial distill status:", e);
      }
    };
    checkStatus();

    const history = localStorage.getItem('vml_source_history');
    if (history) setSourceHistory(JSON.parse(history));
  }, []);

  useEffect(() => {
    if (!selectedCollection) {
      setCollectionData([]);
      return;
    }
    
    const fetchExplorerData = async () => {
      setIsExploring(true);
      try {
        const resp = await fetch("http://127.0.0.1:1001/mcp/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: "explore_knowledge_collection", 
            arguments: { collection: selectedCollection, limit: 50 } 
          })
        });
        const data = await resp.json();
        const text = data.error || data[0]?.text || data.result?.[0]?.text || "";
        if (text.includes("[JSON_RESULTS]")) {
          const jsonStr = text.split("[JSON_RESULTS]")[1].trim();
          const results = JSON.parse(jsonStr);
          setCollectionData(results || []);
        } else {
          setCollectionData([]);
        }
      } catch (e) {
        console.error("Failed to explore collection:", e);
        setCollectionData([]);
      } finally {
        setIsExploring(false);
      }
    };

    fetchExplorerData();
    fetchLocalDatasets(); // RE-FETCH on selection
  }, [selectedCollection]);


  const handleStartDistillation = async (isAgentic: boolean = false) => {
    if (!selectedCollection) return;
    setDistillStatus({ 
      step: 'init', 
      progress: 5, 
      current_task: isAgentic ? 'Initiating Autonomous Agent Mission...' : 'Starting manual distillation...' 
    });
    setShowDistillUI(true);
    try {
      await fetch("http://127.0.0.1:2000/distill/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          collection_name: selectedCollection,
          auto_deploy: isAgentic,
          persona: distillPersona
        })
      });
    } catch (e) {
       setDistillStatus({ step: 'error', progress: 0, current_task: 'Failed to contact Agent.' });
    }
  };

  const handleDeployToHF = async () => {
    if (!selectedCollection) return;
    setDistillStatus(prev => ({ ...prev, step: 'deploying', progress: 95, current_task: 'Initiating HF Handshake...' }));
    try {
      const resp = await fetch("http://127.0.0.1:2000/distill/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection_name: selectedCollection })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
    } catch (e) {
      setDistillStatus({ step: 'error', progress: 0, current_task: (e as Error).message });
    }
  };


  const handleBrowseFile = async () => {
    try {
      const resp = await fetch("http://127.0.0.1:2000/browse_pdf");
      const data = await resp.json();
      if (data.path) {
        setSourceInput(data.path);
        // Auto-generate collection name from filename if not set
        if (!newCollectionName && !selectedCollection) {
          const base = data.path.split(/[\\/]/).pop()?.split('.')[0];
          if (base) setNewCollectionName(base + "-docs");
        }
      }
    } catch (e) {
      console.error("Failed to open file browser:", e);
    }
  };


  const handleIngest = async () => {
    const collection = newCollectionName || selectedCollection;
    if (!collection) {
      setStatusMsg({ text: "Please enter a name for your New Collection below.", type: 'error' });
      return;
    }

    if (!sourceInput) {
      setStatusMsg({ text: "Please provide a source URL or file path.", type: 'error' });
      return;
    }

    setIsMining(true);
    setMiningStep(1);
    setStatusMsg(null);

    // Simulate progress for UI feedback while waiting for one-shot tool
    const progressInterval = setInterval(() => {
      setMiningStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 2000);

    try {
      const resp = await fetch("http://127.0.0.1:1001/mcp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: "ingest_knowledge", 
          arguments: { source: sourceInput, collection: collection } 
        })
      });
      const data = await resp.json();
      const text = data.error || data[0]?.text || data.result?.[0]?.text || "";
      
      clearInterval(progressInterval);
      setMiningStep(5);

      if (text.includes("[JSON_RESULTS]")) {
        const jsonStr = text.split("[JSON_RESULTS]")[1].trim();
        const stats = JSON.parse(jsonStr);
        const report = stats.report;
        
        setStatusMsg({ 
          text: `✅ Harvest Complete: ${report.chunks} chunks indexed from ${report.source} (${Math.round(report.chars/1000)}k chars).`, 
          type: 'success' 
        });
        setTimeout(() => setStatusMsg(null), 10000);

        // Save to history
        const newHistory = [sourceInput, ...sourceHistory.filter(s => s !== sourceInput)].slice(0, 10);
        setSourceHistory(newHistory);
        localStorage.setItem('vml_source_history', JSON.stringify(newHistory));

        setSourceInput('');
        setNewCollectionName('');
        fetchCollections();
      } else {
        setStatusMsg({ text: text || "An unknown ingestion error occurred.", type: 'error' });
      }
    } catch (e) {
      clearInterval(progressInterval);
      setStatusMsg({ text: "Mining Pipeline Interrupted: " + (e as Error).message, type: 'error' });
    } finally {
      setTimeout(() => setIsMining(false), 3000);
    }
  };

  const handleDeleteCollection = async (collectionName: string) => {
    setIsDeleting(collectionName);
    setStatusMsg(null);
    try {
      const resp = await fetch("http://127.0.0.1:1001/mcp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: "delete_knowledge_collection", 
          arguments: { collection: collectionName } 
        })
      });
      const data = await resp.json();
      const text = data.error || data[0]?.text || data.result?.[0]?.text || "";
      if (text.includes("[JSON_RESULTS]")) {
        if (selectedCollection === collectionName) {
           setSelectedCollection(null);
        }
        fetchCollections();
        setStatusMsg({ text: `Collection '${collectionName}' deleted successfully.`, type: 'success' });
        setTimeout(() => setStatusMsg(null), 5000);
      } else {
        setStatusMsg({ text: text || "Failed to delete collection.", type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setStatusMsg({ text: "Delete request failed.", type: 'error' });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#0B090F] text-[#E2D8F0] overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Collections */}
        <div className="w-80 border-r border-purple-500/10 flex flex-col bg-[#0D0B14]">
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest">Collections</h3>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 p-4">
                <Loader2 className="animate-spin" size={16} />
                Loading index...
              </div>
            ) : collections.length === 0 ? (
              <div className="text-center py-12 px-6 rounded-3xl border border-dashed border-purple-500/10 bg-purple-500/5">
                <Database className="mx-auto text-gray-700 mb-3" size={32} />
                <p className="text-xs text-gray-500 leading-relaxed">No knowledge bases yet. Create your first by adding a source on the right.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {collections.map(c => (
                  <div
                    key={c.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCollection(c.name)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                      selectedCollection === c.name 
                        ? 'bg-purple-500/20 border border-purple-500/30 text-purple-200' 
                        : 'hover:bg-purple-500/5 border border-transparent text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${selectedCollection === c.name ? 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-gray-600'}`} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium truncate pr-2" title={c.name}>{c.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono tracking-tighter">{c.count} chunks</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCollection(c.name);
                        }}
                        disabled={isDeleting === c.name}
                        className={`h-7 w-7 p-0 rounded-lg hover:bg-rose-500/20 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity`}
                      >
                        {isDeleting === c.name ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </Button>
                      <ChevronRight size={14} className={`transition-transform ${selectedCollection === c.name ? 'translate-x-1' : 'opacity-0 stroke-gray-500'}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar Storage Footer */}
          <div className="p-6 border-t border-purple-500/10 bg-purple-500/5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-purple-400/60 mb-2">
              <span>Local Storage Usage</span>
              <span className="text-purple-400">{totalStorage.toFixed(1)} MB</span>
            </div>
          </div>
        </div>

        {/* Main Content: Ingestion & Explorer */}
        <div className="flex-1 overflow-y-auto p-12 bg-gradient-to-br from-[#0B090F] via-[#0D0B14] to-[#0B090F]">
          <div className="max-w-3xl mx-auto space-y-10">
            {/* Action Bar */}
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Brain className="text-purple-400" size={20} />
                </div>
                <h2 className="text-lg font-semibold">Ingest New Knowledge</h2>
              </div>

              <div className="grid gap-6 p-8 rounded-3xl bg-[#140F1D]/80 border border-purple-500/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                
                <div className="space-y-4">
                  <label className="text-xs font-bold text-purple-400 uppercase tracking-widest pl-1">Knowledge Source</label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        list="source-history"
                        value={sourceInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSourceInput(val);
                          // Auto-generate collection name if empty
                          if (!newCollectionName && !selectedCollection && val) {
                            try {
                              const url = new URL(val);
                              const slug = url.hostname.split('.')[0] + "-site";
                              setNewCollectionName(slug);
                            } catch (e) {
                              if (val.includes('\\') || val.includes('/')) {
                                 const base = val.split(/[\\/]/).pop()?.split('.')[0];
                                 if (base) setNewCollectionName(base + "-docs");
                              }
                            }
                          }
                        }}
                        placeholder="Local PDF path or Web Link"
                        className="flex-1 bg-[#0D0B14] border border-purple-500/20 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-purple-500 shadow-inner"
                      />
                      <Button 
                        onClick={handleBrowseFile}
                        variant="ghost"
                        className="h-auto px-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400 hover:bg-purple-500/20"
                      >
                        Browse
                      </Button>
                    </div>
                    <datalist id="source-history">
                      {sourceHistory.map(h => <option key={h} value={h} />)}
                      <option value="https://vishnusureshperumbavoor.github.io/V-S-P/" />
                    </datalist>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400">
                      {sourceInput.startsWith('http') ? <Globe size={20} /> : <FileText size={20} />}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-purple-400 uppercase tracking-widest pl-1">Attach to Collection</label>
                    <select 
                      value={selectedCollection || ''}
                      onChange={(e) => {
                        setSelectedCollection(e.target.value);
                        setNewCollectionName('');
                      }}
                      className="w-full bg-[#0D0B14] border border-purple-500/20 rounded-2xl py-4 px-4 text-sm focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select Existing...</option>
                      {collections.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
                    </select>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-purple-400 uppercase tracking-widest pl-1">Or Create New</label>
                    <input 
                      type="text"
                      ref={newNameRef}
                      value={newCollectionName}
                      onChange={(e) => {
                        setNewCollectionName(e.target.value);
                        setSelectedCollection(null);
                      }}
                      placeholder="e.g. Sales-Expert"
                      className="w-full bg-[#0D0B14] border border-purple-500/20 rounded-2xl py-4 px-4 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-4">
                   {isMining ? (
                     <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="grid grid-cols-5 gap-2">
                           {[1,2,3,4,5].map(step => (
                             <div key={step} className={`h-1.5 rounded-full transition-all duration-700 ${
                                miningStep >= step ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-gray-800'
                             }`} />
                           ))}
                        </div>
                        
                        <div className="space-y-4">
                           <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-purple-400">
                              <span>
                                 {miningStep === 1 && "📡 Handshaking..."}
                                 {miningStep === 2 && "⛏️ Mining Content..."}
                                 {miningStep === 3 && "✂️ Semantic Chunking..."}
                                 {miningStep === 4 && "🧠 Encoding Embeddings..."}
                                 {miningStep === 5 && "💾 Finalizing Index..."}
                              </span>
                              <span className="animate-pulse">ACTIVE</span>
                           </div>

                           <div className="p-6 rounded-2xl bg-[#0B090F] border border-purple-500/10 font-mono text-[11px] h-32 overflow-hidden relative">
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0B090F] via-transparent to-transparent pointer-events-none" />
                              <div className="space-y-1.5 text-purple-300/60">
                                 {miningStep >= 2 && (
                                   <div className="animate-in slide-in-from-bottom-2 duration-300">
                                      {"> "} SCRAPING_URL: {sourceInput}...
                                   </div>
                                 )}
                                 {miningStep >= 3 && (
                                   <div className="animate-in slide-in-from-bottom-2 duration-300">
                                      {"> "} INITIALIZING_VML_RECURSIVE_SPLITTER...
                                   </div>
                                 )}
                                 {miningStep >= 4 && (
                                   <div className="animate-in slide-in-from-bottom-2 duration-300">
                                      {"> "} BGE_SMALL_EN_V1_5_ENCODING_READY...
                                   </div>
                                 )}
                                 <div className="text-purple-400 animate-pulse mt-2">
                                    {miningStep === 2 && "> EXTRACTING_CONTENT_CHUNKS..."}
                                    {miningStep === 3 && "> GENERATING_VECTOR_PINS..."}
                                    {miningStep === 4 && "> PERSISTING_TO_CHROMADB..."}
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                   ) : (
                    <>
                      <Button 
                        onClick={handleIngest} 
                        disabled={isMining || !sourceInput}
                        className={`w-full h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-2xl font-semibold uppercase tracking-widest shadow-lg shadow-purple-500/20 transition-all`}
                      >
                        Add to Knowledge Base
                      </Button>

                      {statusMsg && (
                        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm animate-in zoom-in-95 ${
                          statusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          statusMsg.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                          'bg-purple-500/10 border-purple-500/20 text-purple-300'
                        }`}>
                          <div className="flex items-center gap-3">
                            {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : 
                            statusMsg.type === 'error' ? <AlertCircle size={18} /> : 
                            <Loader2 size={18} className="animate-spin" />}
                            <span>{statusMsg.text}</span>
                          </div>
                          {statusMsg.type === 'error' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 hover:bg-rose-500/20 text-rose-400"
                              onClick={() => {
                                navigator.clipboard.writeText(statusMsg.text);
                                setStatusMsg({ ...statusMsg, text: "Error copied to clipboard!" });
                                setTimeout(() => setStatusMsg(statusMsg), 2000);
                              }}
                            >
                              <Copy size={14} />
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                   )}
                </div>
              </div>
            </section>

            {/* Collection Details / Explorer Placeholder */}
            {selectedCollection && (
              <section className="p-8 rounded-3xl border border-purple-500/10 bg-[#140F1D]/30 space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between pb-4 border-b border-purple-500/10 mb-2">
                  <div className="flex items-center gap-3">
                    <Database className="text-purple-400" size={20} />
                    <h3 className="font-bold text-[#E2D8F0]">Active Collection: {selectedCollection}</h3>
                  </div>
                  
                  {collectionData.length > 0 && !isExploring && (
                    <div className="flex items-center gap-2">
                       {localDatasets.find(ds => ds.display_name === selectedCollection && ds.hf_url) ? (
                         <a 
                           href={localDatasets.find(ds => ds.display_name === selectedCollection && ds.hf_url)?.hf_url}
                           target="_blank"
                           rel="noreferrer"
                           className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all animate-in zoom-in-95"
                         >
                            <ExternalLink size={12} />
                            View distilled dataset on HF
                         </a>
                       ) : localDatasets.some(ds => ds.display_name === selectedCollection) ? (
                         <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold animate-in zoom-in-95">
                            <CheckCircle2 size={12} />
                            Dataset Ready (Local)
                         </div>
                       ) : (
                         <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-2 relative">
                             <label className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest pl-1">Expert Persona</label>
                             <div className="relative">
                               <input 
                                  type="text"
                                  value={distillPersona}
                                  onChange={(e) => setDistillPersona(e.target.value)}
                                  placeholder="e.g. Radiologist, Legal Expert..."
                                  className="text-[11px] bg-[#0B090F] border border-indigo-500/30 rounded-xl px-4 py-2 text-indigo-200 outline-none focus:border-indigo-500 font-bold tracking-wide h-9 w-56 shadow-inner"
                               />
                               {distillPersona !== 'Generic' && (
                                 <button 
                                   onClick={() => setDistillPersona('Generic')}
                                   className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-indigo-400/40 hover:text-indigo-400 transition-colors uppercase font-bold"
                                 >
                                   Reset
                                 </button>
                               )}
                             </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              onClick={() => handleStartDistillation(true)}
                              className="text-xs text-indigo-400 hover:bg-indigo-500/10 flex items-center gap-2 px-4 border border-indigo-500/20 bg-indigo-500/5 group h-9 mt-6"
                            >
                              <Sparkles size={12} className="group-hover:animate-pulse" />
                              Distill
                            </Button>
                          </div>
                       )}
                      <Button 
                        variant="ghost" 
                        onClick={() => handleCopyBlock(collectionData.map(b => b.content).join('\n\n'), 'all')}
                        className="text-xs text-purple-400 hover:bg-purple-500/10 flex items-center gap-2"
                      >
                        {copiedId === 'all' ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                        {copiedId === 'all' ? 'Copied All!' : 'Copy Collection'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Distillation Progress UI */}
                {showDistillUI && (
                  <div className={`p-6 rounded-2xl border space-y-4 animate-in slide-in-from-top-4 duration-500 ${
                    distillStatus.step === 'error' ? 'bg-rose-500/5 border-rose-500/20' : 
                    distillStatus.progress > 80 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-indigo-500/5 border-indigo-500/20'
                  }`}>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <Activity className={`${distillStatus.step !== 'complete' && distillStatus.step !== 'deploying' ? 'text-indigo-400 animate-pulse' : 'hidden'}`} size={18} />
                          <Share2 className={`${distillStatus.step === 'deploying' ? 'text-emerald-400 animate-bounce' : 'hidden'}`} size={18} />
                          <CheckCircle2 className={`${distillStatus.step === 'complete' ? 'text-emerald-400' : 'hidden'}`} size={18} />
                          <h4 className={`text-sm font-bold ${distillStatus.step === 'deploying' || distillStatus.step === 'complete' ? 'text-emerald-200' : 'text-indigo-200'}`}>
                            {distillStatus.step === 'deploying' ? 'Autonomous Deployment Agent' : 
                             distillStatus.step === 'complete' ? 'Mission Accomplished' : `Mining: ${selectedCollection}`}
                          </h4>
                       </div>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="h-6 text-[10px] text-gray-500 hover:text-white"
                         onClick={() => setShowDistillUI(false)}
                       >
                         Dismiss
                       </Button>
                    </div>

                    <div className="space-y-2">
                       <div className="flex justify-between text-[10px] font-mono text-indigo-400/80">
                          <span>{distillStatus.current_task}</span>
                          <span>{distillStatus.progress}%</span>
                       </div>
                       <div className="h-1.5 w-full bg-indigo-950 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-1000 ease-out" 
                            style={{ width: `${distillStatus.progress}%` }}
                          />
                       </div>
                    </div>

                    {distillStatus.step === 'complete' && !distillStatus.current_task.includes('http') && (
                       <div className="flex items-center justify-between pt-2">
                          <div className="text-xs text-emerald-400 flex items-center gap-2">
                             <CheckCircle2 size={14} />
                             Knowledge Distilled Successfully.
                          </div>
                       </div>
                    )}

                    {distillStatus.step === 'complete' && distillStatus.current_task.includes('http') && (
                      <div className="pt-4 border-t border-indigo-500/10 flex gap-3">
                         <a 
                           href={distillStatus.current_task.includes('Published to: ') ? distillStatus.current_task.split('Published to: ')[1] : '#'} 
                           target="_blank" 
                           rel="noreferrer"
                           className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                         >
                            <ExternalLink size={16} />
                            View on Hugging Face
                         </a>
                         <button
                           onClick={() => setShowDistillUI(false)}
                           className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 text-xs hover:bg-white/10 transition-all"
                         >
                            Dismiss
                         </button>
                      </div>
                    )}

                    {distillStatus.step === 'error' && (
                       <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                          <AlertCircle size={14} />
                          {distillStatus.current_task}
                       </div>
                    )}
                  </div>
                )}
                
                {isExploring ? (
                  <div className="p-12 text-center rounded-2xl bg-[#0B090F]/50 border border-dashed border-purple-500/10 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={24} className="animate-spin text-purple-400" />
                    <span className="text-gray-500 text-sm">Decoding Semantic Chunks...</span>
                  </div>
                ) : collectionData.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-[#0B090F]/50 border border-dashed border-purple-500/10 text-gray-500 text-sm">
                    This collection appears to be empty.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {collectionData.map((block, i) => (
                      <div key={block.id || i} className="p-5 rounded-2xl bg-[#0B090F] border border-purple-500/10 hover:border-purple-500/30 transition-all group relative">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-mono font-bold text-purple-400/80 uppercase tracking-widest">
                            Block {i + 1}
                          </span>
                          <div className="flex items-center gap-3">
                            {block.metadata?.source && (
                              <span className="text-[10px] text-gray-500 truncate max-w-[200px]" title={block.metadata.source}>
                                {block.metadata.source}
                              </span>
                            )}
                            <button
                              onClick={() => handleCopyBlock(block.content, block.id || i)}
                              className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-colors"
                              title="Copy Block Content"
                            >
                              {copiedId === (block.id || i) ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed font-serif">
                          {block.content}
                        </p>
                      </div>
                    ))}
                    <div className="text-center pt-2 pb-4">
                      <span className="text-xs font-mono text-purple-500/40 uppercase tracking-widest">End of Array (Showing max 50 chunks)</span>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
