'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import DropZone from '@/components/DropZone';
import ResultCard from '@/components/ResultCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn('NEXT_PUBLIC_API_URL is not set — falling back to http://localhost:8000. '
    + 'Set it in Vercel dashboard and redeploy.');
}

interface PredictionResult {
  fen: string;
  fen_standard: string;
  confidence: number;
  min_confidence: number;
  bbox: number[];
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
}

export interface CastlingRights {
  K: boolean;
  Q: boolean;
  k: boolean;
  q: boolean;
}

const DEFAULT_CASTLING: CastlingRights = { K: true, Q: true, k: true, q: true };

function applyFenOverrides(
  result: PredictionResult,
  color: 'w' | 'b',
  castling: CastlingRights,
): PredictionResult {
  // FEN format: "board active_color castling en_passant halfmove fullmove"
  const parts = result.fen_standard.split(' ');
  parts[1] = color;

  const castlingStr =
    (castling.K ? 'K' : '') +
    (castling.Q ? 'Q' : '') +
    (castling.k ? 'k' : '') +
    (castling.q ? 'q' : '') || '-';
  parts[2] = castlingStr;

  const newStandard = parts.join(' ');

  // Regenerate links from the new standard FEN
  const lichessFen = newStandard.replace(/ /g, '_');
  const encodedFen = newStandard.split('/').map(encodeURIComponent).join('/');

  return {
    ...result,
    fen_standard: newStandard,
    links: {
      lichess_editor: `https://lichess.org/editor/${lichessFen}`,
      lichess_analysis: `https://lichess.org/analysis/${lichessFen}`,
      chesscom: `https://www.chess.com/analysis?fen=${encodedFen}`,
    },
  };
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<'w' | 'b'>('w');
  const [perspective, setPerspective] = useState<'white' | 'black'>('white');
  const [castling, setCastling] = useState<CastlingRights>({ ...DEFAULT_CASTLING });
  const [rawResult, setRawResult] = useState<PredictionResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchPromiseRef = useRef<Promise<PredictionResult> | null>(null);

  const handleImageSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
    setRawResult(null);
    setShowResult(false);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Start background fetch immediately
    const formData = new FormData();
    formData.append('file', file);

    const promise = fetch(`${API_URL}/predict?active_color=w`, {
      method: 'POST',
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process image');
      }
      const data = await response.json();
      setRawResult(data);
      return data;
    });

    fetchPromiseRef.current = promise;
  }, []);

  const handleAnalyse = useCallback(async () => {
    if (!fetchPromiseRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      await fetchPromiseRef.current;
      setShowResult(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setActiveColor('w');
    setPerspective('white');
    setCastling({ ...DEFAULT_CASTLING });
    setRawResult(null);
    setShowResult(false);
    setError(null);
    fetchPromiseRef.current = null;
  }, [previewUrl]);

  const handleClearImage = useCallback(() => {
    handleReset();
  }, [handleReset]);

  // Derive the displayed result with the current active color applied
  const displayResult = useMemo(() => {
    if (!rawResult) return null;
    return applyFenOverrides(rawResult, activeColor, castling);
  }, [rawResult, activeColor, castling]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-amber-glow/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ rotate: 15 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <svg
                className="w-8 h-8 text-amber-glow"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19 22H5v-2h14v2M17.16 8.26A4.96 4.96 0 0018 6c0-2.76-2.24-5-5-5S8 3.24 8 6c0 1.01.3 1.95.81 2.74L7 11h2v3H7v4h10v-4h-2v-3h2l-1.84-2.74z"/>
              </svg>
            </motion.div>
            <span className="font-[family-name:var(--font-display)] text-xl text-text-primary">
              FEN Generator
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/about"
              className="text-text-secondary hover:text-amber-glow transition-colors text-sm"
            >
              About
            </Link>
            <a
              href="https://github.com/mohnatz/chess-fen-generator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <AnimatePresence mode="wait">
          {showResult && displayResult ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <ResultCard result={displayResult} activeColor={activeColor} onActiveColorChange={setActiveColor} perspective={perspective} onPerspectiveChange={setPerspective} castling={castling} onCastlingChange={setCastling} onReset={handleReset} file={selectedFile!} />
            </motion.div>
          ) : selectedFile && previewUrl ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl"
            >
              {/* Hero Text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-12"
              >
                <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl text-text-primary mb-4">
                  Screenshot to <span className="text-amber-glow">FEN</span>
                </h1>
                <p className="text-text-secondary text-lg max-w-lg mx-auto">
                  Choose whose turn it is, then analyse the position.
                </p>
              </motion.div>

              {/* Preview Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                className="w-full max-w-2xl mx-auto"
              >
                <div className="relative overflow-hidden rounded-2xl">
                  {/* Animated border */}
                  <div className="absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-br from-amber-glow/40 via-transparent to-amber-glow/40 opacity-50">
                    <div className="w-full h-full rounded-2xl bg-bg-surface" />
                  </div>

                  <div className="relative z-10 p-8 md:p-12 bg-bg-surface/80 backdrop-blur-sm rounded-2xl border-2 border-solid border-amber-glow/20">
                    {/* Image Preview */}
                    <div className="relative">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full max-h-[400px] object-contain rounded-lg amber-glow"
                      />
                      <button
                        onClick={handleClearImage}
                        className="absolute top-3 right-3 p-2 bg-bg-deep/80 rounded-full
                                 hover:bg-danger/20 hover:text-danger transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Turn Toggle */}
                    <div className="mt-6 flex flex-col items-center gap-4">
                      <span className="text-text-secondary text-sm">Who moves next?</span>
                      <div className="inline-flex rounded-xl bg-bg-deep p-1 border border-text-muted/20">
                        <button
                          onClick={() => setActiveColor('w')}
                          className={`
                            px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            flex items-center gap-2
                            ${activeColor === 'w'
                              ? 'bg-white text-gray-900 shadow-md'
                              : 'text-text-muted hover:text-text-secondary'
                            }
                          `}
                        >
                          <span className="w-3 h-3 rounded-full bg-white border border-gray-300 inline-block" />
                          White to move
                        </button>
                        <button
                          onClick={() => setActiveColor('b')}
                          className={`
                            px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            flex items-center gap-2
                            ${activeColor === 'b'
                              ? 'bg-gray-800 text-white shadow-md'
                              : 'text-text-muted hover:text-text-secondary'
                            }
                          `}
                        >
                          <span className="w-3 h-3 rounded-full bg-gray-800 border border-gray-600 inline-block" />
                          Black to move
                        </button>
                      </div>
                    </div>

                    {/* Board Perspective Toggle */}
                    <div className="mt-4 flex flex-col items-center gap-4">
                      <span className="text-text-secondary text-sm">Which side is at the bottom of the screenshot?</span>
                      <div className="inline-flex rounded-xl bg-bg-deep p-1 border border-text-muted/20">
                        <button
                          onClick={() => setPerspective('white')}
                          className={`
                            px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            flex items-center gap-2
                            ${perspective === 'white'
                              ? 'bg-white text-gray-900 shadow-md'
                              : 'text-text-muted hover:text-text-secondary'
                            }
                          `}
                        >
                          <span className="w-3 h-3 rounded-full bg-white border border-gray-300 inline-block" />
                          White at the bottom
                        </button>
                        <button
                          onClick={() => setPerspective('black')}
                          className={`
                            px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            flex items-center gap-2
                            ${perspective === 'black'
                              ? 'bg-gray-800 text-white shadow-md'
                              : 'text-text-muted hover:text-text-secondary'
                            }
                          `}
                        >
                          <span className="w-3 h-3 rounded-full bg-gray-800 border border-gray-600 inline-block" />
                          Black at the bottom
                        </button>
                      </div>
                    </div>

                    {/* Analyse Button */}
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={handleAnalyse}
                        disabled={isLoading}
                        className="
                          inline-flex items-center gap-3 px-8 py-3.5
                          bg-amber-glow hover:bg-amber-bright text-bg-deep
                          rounded-xl font-medium text-base
                          transition-all duration-200
                          hover:scale-[1.02] active:scale-[0.98]
                          disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100
                        "
                      >
                        {isLoading ? (
                          <>
                            <ChessSpinner />
                            Analysing...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Analyse the position
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Error Display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-6 p-4 bg-danger/10 border border-danger/30 rounded-xl text-center"
                  >
                    <p className="text-danger text-sm">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="mt-2 text-text-muted hover:text-text-primary text-sm"
                    >
                      Dismiss
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl"
            >
              {/* Hero Text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-12"
              >
                <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl text-text-primary mb-4">
                  Screenshot to <span className="text-amber-glow">FEN</span>
                </h1>
                <p className="text-text-secondary text-lg max-w-lg mx-auto">
                  Upload a chess screenshot and instantly get FEN notation.
                  Analyze positions on Lichess or Chess.com with one click.
                </p>
              </motion.div>

              {/* Drop Zone */}
              <DropZone onImageSelect={handleImageSelect} onError={setError} />

              {/* Error Display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-6 p-4 bg-danger/10 border border-danger/30 rounded-xl text-center"
                  >
                    <p className="text-danger text-sm">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="mt-2 text-text-muted hover:text-text-primary text-sm"
                    >
                      Dismiss
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Features */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="mt-16 grid grid-cols-3 gap-6"
              >
                {[
                  { icon: '🎯', label: 'Board Detection', desc: 'Automatic crop' },
                  { icon: '🧠', label: 'ML Recognition', desc: 'Piece identification' },
                  { icon: '⚡', label: 'Instant Links', desc: 'One-click analysis' },
                ].map((feature, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl mb-2">{feature.icon}</div>
                    <div className="text-text-primary text-sm font-medium">{feature.label}</div>
                    <div className="text-text-muted text-xs">{feature.desc}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-glow/10 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-text-muted">
          <span>Created by <a href="https://github.com/mohnatz" target="_blank" rel="noopener noreferrer" className="hover:text-amber-glow transition-colors">mohnatz</a> for educational purposes</span>
          <span>
            <Link href="/about" className="hover:text-amber-glow transition-colors">
              About →
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function ChessSpinner() {
  return (
    <div className="relative w-5 h-5">
      <motion.div
        className="absolute inset-0 border-2 border-bg-deep/20 rounded-full"
      />
      <motion.div
        className="absolute inset-0 border-2 border-transparent border-t-bg-deep rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}
