import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface HuggingFaceAuthProps {
    envKey: string;
    placeholder: string;
}

export const HuggingFaceAuth: React.FC<HuggingFaceAuthProps> = ({ envKey, placeholder }) => {
    const [val, setVal] = useState('');
    const [state, setState] = useState<'idle'|'saving'|'success'|'error'>('idle');

    const handleSave = async () => {
        if (!val.trim()) return;
        setState('saving');
        try {
            const resp = await fetch("http://127.0.0.1:2000/save_token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: envKey, value: val.trim() })
            });
            if (!resp.ok) throw new Error("Failed to save");
            setState('success');
        } catch (e) {
            setState('error');
            setTimeout(() => setState('idle'), 3000);
        }
    };

    return (
        <div className="my-4 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-2xl animate-in slide-in-from-left-4 duration-500">
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
                <div className="p-1.5 bg-amber-500/20 rounded-lg">
                    <AlertCircle className="text-amber-500" size={16} />
                </div>
                <div>
                    <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wider">Hugging Face Auth Required</h4>
                    <p className="text-[10px] text-amber-400/70">Enable high-speed downloads and private model access.</p>
                </div>
            </div>
            
            {state === 'success' ? (
                <div className="p-4 flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs animate-in zoom-in duration-300">
                    <CheckCircle2 size={16} />
                    <span>TOKEN ACTIVATED & SAVED TO .ENV</span>
                </div>
            ) : (
                <div className="p-4 flex gap-2 items-center">
                    <div className="relative flex-1">
                        <input 
                            type="password"
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            placeholder={placeholder}
                            className="w-full bg-[#0B090F] border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-amber-500/30 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all font-mono"
                        />
                    </div>
                    <button 
                        onClick={handleSave}
                        disabled={state === 'saving' || !val.trim()}
                        className={`flex-none px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all
                            ${state === 'saving' ? 'bg-amber-500/20 text-amber-500 opacity-50' : 
                            'bg-amber-500 text-black hover:scale-105 active:scale-95 shadow-lg shadow-amber-900/40'}
                        `}
                    >
                        {state === 'saving' ? 'Applying...' : 'Authorize'}
                    </button>
                    {state === 'error' && <span className="text-[10px] text-red-500 font-bold animate-pulse">Error!</span>}
                </div>
            )}
        </div>
    );
};
