'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface DropZoneProps {
  onImageSelect: (file: File) => void;
  onError?: (message: string) => void;
}

export default function DropZone({ onImageSelect, onError }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      onError?.('Unsupported file type. Please upload a PNG, JPEG, or WEBP image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      onError?.('File too large. Maximum size is 10 MB.');
      return;
    }
    onImageSelect(file);
  }, [onImageSelect, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Clipboard paste handler (desktop Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFile]);

  // Clipboard read via button tap (mobile / iOS Safari)
  const handleClipboardRead = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'clipboard-image.png', { type: imageType });
          handleFile(file);
          return;
        }
      }
      onError?.('No image found in clipboard. Copy a screenshot first, then tap Paste.');
    } catch {
      onError?.('Could not access clipboard. Please use "Choose Image" instead.');
    }
  }, [handleFile, onError]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-2xl mx-auto"
    >
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative overflow-hidden rounded-2xl
          transition-all duration-300 ease-out
          ${isDragging ? 'scale-[1.02]' : 'scale-100'}
        `}
      >
        {/* Animated border */}
        <div className={`
          absolute inset-0 rounded-2xl p-[2px]
          bg-gradient-to-br from-amber-glow/40 via-transparent to-amber-glow/40
          ${isDragging ? 'opacity-100' : 'opacity-50'}
          transition-opacity duration-300
        `}>
          <div className="w-full h-full rounded-2xl bg-bg-surface" />
        </div>

        {/* Content */}
        <div className={`
          relative z-10 p-8 md:p-12
          bg-bg-surface/80 backdrop-blur-sm rounded-2xl
          border-2 border-dashed
          ${isDragging ? 'border-amber-glow bg-amber-glow/5' : 'border-text-muted/30'}
          transition-all duration-300
        `}>
          <motion.div
            className="flex flex-col items-center gap-6 py-8"
          >
            {/* Chess piece icon */}
            <motion.div
              animate={{
                y: isDragging ? -10 : 0,
                scale: isDragging ? 1.1 : 1
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <svg
                className={`w-20 h-20 ${isDragging ? 'text-amber-glow' : 'text-text-muted'} transition-colors duration-300`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19 22H5v-2h14v2M17.16 8.26A4.96 4.96 0 0018 6c0-2.76-2.24-5-5-5S8 3.24 8 6c0 1.01.3 1.95.81 2.74L7 11h2v3H7v4h10v-4h-2v-3h2l-1.84-2.74z"/>
              </svg>
            </motion.div>

            <div className="text-center space-y-3">
              <h3 className="text-xl font-[family-name:var(--font-display)] text-text-primary">
                {isDragging ? 'Drop your screenshot' : 'Upload Chess Screenshot'}
              </h3>
              <p className="text-text-secondary text-sm max-w-sm">
                <span className="hidden md:inline">Drag & drop, paste from clipboard <kbd className="px-1.5 py-0.5 bg-bg-elevated rounded text-xs text-amber-dim">Ctrl+V</kbd>, or click to browse</span>
                <span className="md:hidden">Paste a screenshot from your clipboard or choose from your photos</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleClipboardRead}
                className="
                  inline-flex items-center gap-2 px-6 py-3
                  bg-amber-glow/10 border border-amber-glow/40
                  rounded-xl text-amber-glow text-sm font-medium
                  hover:bg-amber-glow/20 hover:border-amber-glow/60
                  active:scale-[0.98]
                  transition-all duration-200
                "
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Paste from Clipboard
              </button>

              <label className="cursor-pointer group">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <span className="
                  inline-flex items-center gap-2 px-6 py-3
                  bg-bg-elevated border border-amber-glow/30
                  rounded-xl text-amber-glow text-sm font-medium
                  group-hover:bg-amber-glow/10 group-hover:border-amber-glow/60
                  transition-all duration-200
                ">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose Image
                </span>
              </label>
            </div>

            {/* Mini chessboard decoration */}
            <div className="flex gap-0.5 opacity-30 mt-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  {[...Array(8)].map((_, j) => (
                    <div
                      key={j}
                      className={`w-2 h-2 rounded-sm ${(i + j) % 2 === 0 ? 'bg-square-light' : 'bg-square-dark'}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
