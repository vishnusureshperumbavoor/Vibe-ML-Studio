import React from 'react';

interface RenderedImageProps {
  source: string;
}

export const RenderedImage: React.FC<RenderedImageProps> = ({ source }) => {
  const isUrl = source.startsWith('http://') || source.startsWith('https://');
  const imgSrc = isUrl ? source : `http://127.0.0.1:2000/images/${source}?t=${Date.now()}`;

  return (
    <div className="my-4 bg-[#140F1D] rounded-xl overflow-hidden border border-[#352554] shadow-2xl max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
        <div className="p-2 border-b border-[#352554] bg-[#0B090F] flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-tighter">
            <span className="flex items-center gap-1.5 font-bold text-purple-400">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                {isUrl ? 'EXTERNAL_IMAGE' : `RENDERED_OUTPUT: ${source}`}
            </span>
            <a 
                href={imgSrc} 
                target="_blank" 
                rel="noreferrer"
                className="hover:text-white transition-colors"
            >
                OPEN_ORIGINAL
            </a>
        </div>
        <img 
            src={imgSrc} 
            alt={source}
            className="w-full h-auto object-contain bg-black min-h-[100px]"
            onError={(e) => {
                (e.target as any).src = `https://via.placeholder.com/600x400?text=Error_Loading_Image_${encodeURIComponent(source)}`;
            }}
        />
    </div>
  );
};
