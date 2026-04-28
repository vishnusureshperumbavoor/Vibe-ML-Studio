import React, { useRef, useEffect } from 'react';

interface EditorAreaProps {
  value: string;
  onChange: (value: string) => void;
  language: 'python' | 'markdown';
  onRun?: () => void;
  placeholder?: string;
  readOnly?: boolean;
}

export const EditorArea: React.FC<EditorAreaProps> = ({ 
  value, 
  onChange, 
  language, 
  onRun,
  placeholder,
  readOnly = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun?.();
    }
  };

  const bgClass = language === 'python' 
    ? 'bg-[#1D152A] border-[#352554] focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50' 
    : 'bg-transparent border-transparent hover:border-[#352554] focus-within:border-[#352554]';

  const textClass = language === 'python'
    ? 'text-[#E2D8F0]'
    : 'text-[#E2D8F0]';

  return (
    <div className={`relative w-full rounded-md border transition-all duration-200 ${bgClass}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={false}
        className={`w-full bg-transparent resize-none p-4 outline-none font-mono text-sm leading-6 ${textClass} placeholder-gray-500`}
        style={{ minHeight: language === 'python' ? '80px' : '40px' }}
      />
      {language === 'python' && !readOnly && (
        <div className="absolute top-2 right-2 text-xs text-gray-500 select-none pointer-events-none font-sans">
          Python
        </div>
      )}
    </div>
  );
};