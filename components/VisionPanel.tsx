import React, { useState, useEffect } from 'react';
import { Sparkles, Download, CheckCircle2, Loader2, Play, ExternalLink, HardDrive, Cpu, Image as ImageIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface VisionPanelProps {
  onNavigateToCreative?: () => void;
}

export const VisionPanel: React.FC<VisionPanelProps> = ({ onNavigateToCreative }) => {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isChecking, setIsChecking] = useState(true);
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const [backendType, setBackendType] = useState<string>('OpenVINO / PyTorch');

  const checkStatus = async () => {
    try {
      const res = await fetch('http://127.0.0.1:2000/image/status?model_id=stable-diffusion-v1-5/stable-diffusion-v1-5');
      if (res.ok) {
        const data = await res.json();
        if (data.is_downloaded || data.status === 'ready') {
          setStatus('ready');
        } else if (data.status === 'downloading') {
          setStatus('downloading');
        } else if (data.status === 'error') {
          setStatus('error');
        } else {
          setStatus('idle');
        }
        if (data.message) setStatusMessage(data.message);
        if (data.backend) setBackendType(data.backend);
      }
    } catch (e) {
      console.error('Failed to check image model status:', e);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      checkStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = async () => {
    setIsStartingDownload(true);
    try {
      const formData = new FormData();
      formData.append('model_id', 'stable-diffusion-v1-5/stable-diffusion-v1-5');
      const res = await fetch('http://127.0.0.1:2000/image/download', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setStatus('downloading');
        setStatusMessage('Download started in background...');
      }
    } catch (e) {
      console.error('Download start failed:', e);
      setStatus('error');
      setStatusMessage('Failed to connect to backend server on port 2000.');
    } finally {
      setIsStartingDownload(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-[#0B090F] border border-white/5 rounded-2xl shadow-inner">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500/20 to-purple-600/20 border border-amber-500/30 rounded-2xl text-amber-400 shadow-lg shadow-amber-500/5">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">Stable Diffusion v1.5</h3>
              <a
                href="https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5"
                target="_blank"
                rel="noreferrer"
                className="text-white/40 hover:text-white transition-colors"
                title="View on Hugging Face"
              >
                <ExternalLink size={14} />
              </a>
            </div>
            <p className="text-xs text-white/50 mt-1 font-mono">
              stable-diffusion-v1-5/stable-diffusion-v1-5
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {isChecking ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-white/40 text-xs font-semibold border border-white/10">
              <Loader2 size={12} className="animate-spin" /> Checking status...
            </span>
          ) : status === 'ready' ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <CheckCircle2 size={14} /> READY & CACHED
            </span>
          ) : status === 'downloading' ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <Loader2 size={14} className="animate-spin" /> DOWNLOADING (~4.2 GB)
            </span>
          ) : status === 'error' ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
              <AlertCircle size={14} /> ERROR
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-white/60 text-xs font-bold border border-white/10">
              <Download size={14} /> NOT DOWNLOADED
            </span>
          )}
        </div>
      </div>

      {/* Main Download Card */}
      <div className="p-8 bg-gradient-to-b from-[#121016] to-[#0D0B12] border border-white/10 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center gap-2 text-white/40 text-[11px] font-bold uppercase tracking-wider">
              <HardDrive size={13} /> Model Size
            </div>
            <div className="text-sm font-bold text-white">~4.27 GB (FP16/FP32)</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center gap-2 text-white/40 text-[11px] font-bold uppercase tracking-wider">
              <Cpu size={13} /> Inference Engine
            </div>
            <div className="text-sm font-bold text-white">{backendType}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center gap-2 text-white/40 text-[11px] font-bold uppercase tracking-wider">
              <ImageIcon size={13} /> Native Output
            </div>
            <div className="text-sm font-bold text-white">512 × 512 Pixels</div>
          </div>
        </div>

        <p className="text-xs text-white/60 leading-relaxed">
          Stable Diffusion 1.5 is a latent text-to-image diffusion model capable of generating photo-realistic images from natural language descriptions and refining images via Image-to-Image synthesis in the <strong>Creative Studio</strong>.
        </p>

        {statusMessage && (
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white/70 flex items-center gap-2">
            <RefreshCw size={12} className={status === 'downloading' ? 'animate-spin text-amber-400' : 'text-white/40'} />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
          {status === 'ready' ? (
            <Button
              onClick={onNavigateToCreative}
              size="lg"
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-purple-600/25 flex items-center justify-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              Open in Creative Studio
            </Button>
          ) : (
            <Button
              onClick={handleDownload}
              disabled={status === 'downloading' || isStartingDownload}
              size="lg"
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-4 rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              {status === 'downloading' || isStartingDownload ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Downloading Model Weights...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Download Stable Diffusion 1.5</span>
                </>
              )}
            </Button>
          )}

          {status === 'ready' && (
            <button
              onClick={handleDownload}
              disabled={status === 'downloading'}
              className="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1.5 px-4 py-2"
            >
              <RefreshCw size={12} /> Force Re-download
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
