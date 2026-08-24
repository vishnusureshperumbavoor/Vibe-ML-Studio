import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Wand2, Play, Image as ImageIcon, Upload, RefreshCw, Download, CheckCircle2, Loader2, AlertCircle, HardDrive } from 'lucide-react';
import { RenderedImage } from './RenderedImage';

interface CreativeStudioProps {
  onGenerate: (params: { prompt: string; mode: string; strength: number; guidance_scale: number; base_image?: File }) => void;
  isGenerating: boolean;
  lastGeneratedImage?: string;
}

export const CreativeStudio: React.FC<CreativeStudioProps> = ({ onGenerate, isGenerating, lastGeneratedImage }) => {
  const [mode, setMode] = useState<'text2img' | 'img2img'>('text2img');
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(0.6);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [baseImage, setBaseImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Model status & download state
  const [modelStatus, setModelStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);

  const checkModelStatus = async () => {
    try {
      const res = await fetch('http://127.0.0.1:2000/image/status?model_id=stable-diffusion-v1-5/stable-diffusion-v1-5');
      if (res.ok) {
        const data = await res.json();
        if (data.is_downloaded || data.status === 'ready') {
          setModelStatus('ready');
        } else if (data.status === 'downloading') {
          setModelStatus('downloading');
        } else if (data.status === 'error') {
          setModelStatus('error');
        } else {
          setModelStatus('idle');
        }
        if (data.message) setStatusMessage(data.message);
      }
    } catch (e) {
      // Backend not reached
    }
  };

  useEffect(() => {
    checkModelStatus();
    const interval = setInterval(checkModelStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDownloadModel = async () => {
    setIsDownloading(true);
    try {
      const formData = new FormData();
      formData.append('model_id', 'stable-diffusion-v1-5/stable-diffusion-v1-5');
      const res = await fetch('http://127.0.0.1:2000/image/download', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setModelStatus('downloading');
        setStatusMessage('Downloading Stable Diffusion 1.5 weights from Hugging Face...');
      }
    } catch (e) {
      setModelStatus('error');
      setStatusMessage('Failed to trigger download.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBaseImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onGenerate({
      prompt,
      mode,
      strength,
      guidance_scale: guidanceScale,
      base_image: baseImage || undefined
    });
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0B090F] overflow-hidden">
      {/* Header */}
      <div className="flex-none p-6 border-b border-[#352554] bg-[#140F1D]/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">VML Image Generation</h2>
            <p className="text-[10px] text-purple-400/60 uppercase font-bold tracking-widest">Stable Diffusion 1.5</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#1D152A] p-1 rounded-xl border border-[#352554]">
            <button
              onClick={() => setMode('text2img')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${mode === 'text2img' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-500 hover:text-gray-300'}`}
            >
              TXT2IMG
            </button>
            <button
              onClick={() => setMode('img2img')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${mode === 'img2img' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-500 hover:text-gray-300'}`}
            >
              IMG2IMG
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
        {/* Left Column: Settings */}
        <div className="w-full md:w-[400px] space-y-6 shrink-0">
          {/* Download Banner if model is not ready */}
          {modelStatus !== 'ready' && (
            <div className="p-5 rounded-2xl bg-gradient-to-b from-[#1E1428] to-[#140F1D] border border-purple-500/30 space-y-3 shadow-xl shadow-purple-950/30 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive size={15} className="text-purple-400" />
                  <span className="text-xs font-bold text-white tracking-tight">Model Required (~4.2 GB)</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  SD 1.5
                </span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Download the Stable Diffusion 1.5 checkpoint to your local machine for fast GPU/CPU generation.
              </p>
              {statusMessage && (
                <div className="text-[10px] text-amber-300 font-mono bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  {statusMessage}
                </div>
              )}
              <button
                onClick={handleDownloadModel}
                disabled={modelStatus === 'downloading' || isDownloading}
                className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/50 text-white text-xs font-bold transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2"
              >
                {modelStatus === 'downloading' || isDownloading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Downloading from Hugging Face...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Download Stable Diffusion 1.5</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Wand2 size={12} /> Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to create..."
              className="w-full h-32 bg-[#140F1D] border border-[#352554] rounded-2xl p-4 text-sm text-[#E2D8F0] placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
            />
          </div>

          {mode === 'img2img' && (
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Upload size={12} /> Base Image
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`w-full aspect-video rounded-2xl border-2 border-dashed border-[#352554] bg-[#140F1D] flex flex-col items-center justify-center cursor-pointer hover:border-purple-500/30 transition-all overflow-hidden relative group`}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <RefreshCw className="text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <ImageIcon size={32} className="text-gray-700 mb-2" />
                    <span className="text-xs text-gray-500 font-medium">Click to upload</span>
                  </>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isGenerating || !prompt.trim() || (mode === 'img2img' && !baseImage)}
            className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all shadow-2xl scale-100 active:scale-95
              ${isGenerating || !prompt.trim() || (mode === 'img2img' && !baseImage)
                ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                : 'bg-white text-black hover:bg-neutral-200 hover:shadow-white/10'}
            `}
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                <span>GENERATING ON GPU/CPU...</span>
              </>
            ) : (
              <>
                <Play size={18} fill="currentColor" />
                <span>GENERATE IMAGE</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Result */}
        <div className="flex-1 min-h-[400px] rounded-3xl bg-black/40 border border-[#352554] border-dashed flex flex-col items-center justify-center relative overflow-hidden group">
          {lastGeneratedImage ? (
            <div className="w-full h-full p-4 animate-in fade-in zoom-in-95 duration-700">
              <RenderedImage source={lastGeneratedImage} />
            </div>
          ) : (
            <div className="flex flex-col items-center text-center p-8 space-y-4 opacity-40 group-hover:opacity-60 transition-opacity">
              <div className="w-20 h-20 rounded-full border-2 border-[#352554] flex items-center justify-center">
                <ImageIcon size={32} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">VML Canvas</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto mt-2 italic leading-relaxed">
                  Enter a prompt on the left to materialize an image from the latent space.
                </p>
              </div>
            </div>
          )}

          {/* Background Decorative elements */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none" />

          <div className="absolute top-6 right-6 flex gap-2">
            <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/5 flex items-center gap-2">
              {modelStatus === 'ready' ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-emerald-400 tracking-widest uppercase">Model Ready</span>
                </>
              ) : modelStatus === 'downloading' ? (
                <>
                  <Loader2 size={10} className="animate-spin text-amber-400" />
                  <span className="text-[9px] font-bold text-amber-400 tracking-widest uppercase">Downloading...</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[9px] font-bold text-amber-400/80 tracking-widest uppercase">Not Downloaded</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
