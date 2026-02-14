'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { CastlingRights } from '@/app/page';
import PipelineSteps from './PipelineSteps';

interface ResultCardProps {
  result: {
    fen: string;
    fen_standard: string;
    confidence: number;
    min_confidence: number;
    annotated_image_base64: string;
    low_confidence_squares: Array<{
      row: number;
      col: number;
      piece: string;
      confidence: number;
    }>;
    links: {
      lichess_editor: string;
      lichess_analysis: string;
      chesscom: string;
    };
  };
  activeColor: 'w' | 'b';
  onActiveColorChange: (color: 'w' | 'b') => void;
  castling: CastlingRights;
  onCastlingChange: (castling: CastlingRights) => void;
  onReset: () => void;
  file: File;
}

export default function ResultCard({ result, activeColor, onActiveColorChange, castling, onCastlingChange, onReset, file }: ResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedStandard, setCopiedStandard] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (advancedRef.current && !advancedRef.current.contains(e.target as Node)) {
        setAdvancedOpen(false);
      }
    }
    if (advancedOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [advancedOpen]);

  const toggleCastling = (key: keyof CastlingRights) => {
    onCastlingChange({ ...castling, [key]: !castling[key] });
  };

  const copyToClipboard = async (text: string, isStandard: boolean = false) => {
    await navigator.clipboard.writeText(text);
    if (isStandard) {
      setCopiedStandard(true);
      setTimeout(() => setCopiedStandard(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const confidenceColor = result.confidence >= 0.9
    ? 'text-success'
    : result.confidence >= 0.7
    ? 'text-warning'
    : 'text-danger';

  const confidenceLabel = result.confidence >= 0.9
    ? 'High Confidence'
    : result.confidence >= 0.7
    ? 'Medium Confidence'
    : 'Low Confidence';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="bg-bg-surface/90 backdrop-blur-sm rounded-2xl border border-amber-glow/20 overflow-hidden amber-glow">
        {/* Header */}
        <div className="px-6 py-4 border-b border-amber-glow/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <h2 className="font-[family-name:var(--font-display)] text-lg text-text-primary">
              Position Detected
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg bg-bg-deep p-0.5 border border-text-muted/20">
              <button
                onClick={() => onActiveColorChange('w')}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                  flex items-center gap-1.5
                  ${activeColor === 'w'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                  }
                `}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-300 inline-block" />
                White
              </button>
              <button
                onClick={() => onActiveColorChange('b')}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                  flex items-center gap-1.5
                  ${activeColor === 'b'
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                  }
                `}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-gray-800 border border-gray-600 inline-block" />
                Black
              </button>
            </div>
            <div ref={advancedRef} className="relative">
              <button
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                  flex items-center gap-1.5 border
                  ${advancedOpen
                    ? 'bg-bg-elevated border-amber-glow/30 text-amber-glow'
                    : 'border-text-muted/20 text-text-muted hover:text-text-secondary hover:border-text-muted/40'
                  }
                `}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Advanced
                <svg className={`w-3 h-3 transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <AnimatePresence>
                {advancedOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 z-50 w-56 bg-bg-deep border border-text-muted/20 rounded-xl shadow-lg shadow-black/30 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-text-muted/10">
                      <span className="text-text-muted text-xs font-medium">Castling Rights</span>
                    </div>
                    {([
                      { key: 'K' as const, label: 'White King-side', symbol: 'K' },
                      { key: 'Q' as const, label: 'White Queen-side', symbol: 'Q' },
                      { key: 'k' as const, label: 'Black King-side', symbol: 'k' },
                      { key: 'q' as const, label: 'Black Queen-side', symbol: 'q' },
                    ]).map(({ key, label, symbol }) => (
                      <button
                        key={key}
                        onClick={() => toggleCastling(key)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-bg-elevated/50 transition-colors"
                      >
                        <span className="text-text-secondary text-xs flex items-center gap-2">
                          <code className="text-amber-glow/70 bg-bg-elevated px-1.5 py-0.5 rounded text-[10px] font-bold">{symbol}</code>
                          {label}
                        </span>
                        <div
                          className={`
                            relative w-8 h-[18px] rounded-full transition-colors duration-200
                            ${castling[key] ? 'bg-amber-glow' : 'bg-text-muted/30'}
                          `}
                        >
                          <div
                            className={`
                              absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm
                              transition-transform duration-200
                              ${castling[key] ? 'translate-x-[16px]' : 'translate-x-[2px]'}
                            `}
                          />
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={onReset}
              className="text-text-muted hover:text-text-primary transition-colors text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              New Image
            </button>
          </div>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6">
          {/* Annotated Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <img
              src={result.annotated_image_base64}
              alt="Detected board"
              className="w-full rounded-xl border border-amber-glow/20"
            />
          </motion.div>

          {/* Results Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col gap-5"
          >
            {/* Confidence Indicator */}
            <div className="bg-bg-elevated rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-secondary text-sm">Detection Confidence</span>
                <span className={`text-sm font-medium ${confidenceColor}`}>
                  {confidenceLabel}
                </span>
              </div>
              <div className="relative h-2 bg-bg-deep rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.confidence * 100}%` }}
                  transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    result.confidence >= 0.9 ? 'bg-success' :
                    result.confidence >= 0.7 ? 'bg-warning' : 'bg-danger'
                  }`}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-text-muted">
                <span>Avg: {(result.confidence * 100).toFixed(1)}%</span>
                <span>Min: {(result.min_confidence * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* FEN Display */}
            <div className="bg-bg-elevated rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary text-sm">FEN Notation</span>
                <button
                  onClick={() => copyToClipboard(result.fen)}
                  className="text-amber-glow hover:text-amber-bright transition-colors text-sm flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <code className="fen-display block bg-bg-deep px-4 py-3 rounded-lg text-amber-glow text-sm break-all">
                {result.fen}
              </code>

              {/* Standard FEN */}
              <div className="mt-3 pt-3 border-t border-text-muted/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-muted text-xs">Standard FEN</span>
                  <button
                    onClick={() => copyToClipboard(result.fen_standard, true)}
                    className="text-text-muted hover:text-amber-glow transition-colors text-xs flex items-center gap-1"
                  >
                    {copiedStandard ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <code className="fen-display block text-text-muted text-xs break-all">
                  {result.fen_standard}
                </code>
              </div>
            </div>

            {/* Low Confidence Warning */}
            {result.low_confidence_squares.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-warning/10 border border-warning/30 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-warning text-sm font-medium">
                      {result.low_confidence_squares.length} uncertain square{result.low_confidence_squares.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-text-muted text-xs mt-1">
                      {result.low_confidence_squares.slice(0, 3).map(sq =>
                        `${String.fromCharCode(97 + sq.col)}${8 - sq.row}: ${sq.piece} (${(sq.confidence * 100).toFixed(0)}%)`
                      ).join(', ')}
                      {result.low_confidence_squares.length > 3 && ` +${result.low_confidence_squares.length - 3} more`}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Analysis Links */}
            <div className="grid grid-cols-1 gap-3 mt-auto">
              <a
                href={result.links.lichess_analysis}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 px-4 py-3.5
                         bg-[#629924] hover:bg-[#72a92e] text-white
                         rounded-xl font-medium transition-all duration-200
                         hover:scale-[1.02] active:scale-[0.98]"
              >
                <LichessIcon />
                Analyze on Lichess
              </a>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={result.links.lichess_editor}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5
                           bg-bg-elevated hover:bg-bg-elevated/80 border border-text-muted/20
                           rounded-xl text-sm text-text-secondary hover:text-text-primary
                           transition-all duration-200"
                >
                  <LichessIcon className="w-4 h-4" />
                  Board Editor
                </a>

                <a
                  href={result.links.chesscom}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5
                           bg-bg-elevated hover:bg-bg-elevated/80 border border-text-muted/20
                           rounded-xl text-sm text-text-secondary hover:text-text-primary
                           transition-all duration-200"
                >
                  <ChessComIcon className="w-4 h-4" />
                  Chess.com
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Pipeline Visualization */}
        <PipelineSteps file={file} />
      </div>
    </motion.div>
  );
}

function LichessIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 50 50" fill="currentColor">
      <path d="M25 0c-5.9 0-11.5 2.1-15.9 5.9L25 25 40.9 5.9C36.5 2.1 30.9 0 25 0zM9.1 5.9C3.5 10.3 0 17.2 0 25c0 5.9 2.1 11.5 5.9 15.9L25 25 9.1 5.9zM44.1 9.1 25 25l15.9 19.1c3.8-4.4 5.9-10 5.9-15.9 0-5.9-2.1-11.5-5.9-15.9l-.8-.2zM5.9 40.9c4.4 3.8 10 5.9 15.9 5.9 5.9 0 11.5-2.1 15.9-5.9L25 25 5.9 40.9z"/>
    </svg>
  );
}

function ChessComIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm0 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2zm-3 5v2h2v2H9v2h2v2H9v2h2v-2h2v2h2v-2h-2v-2h2v-2h-2v-2h2V9h-2v2h-2V9H9zm2 4h2v2h-2v-2z"/>
    </svg>
  );
}
