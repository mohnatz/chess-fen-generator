'use client';

import { motion } from 'motion/react';
import Link from 'next/link';

export default function AboutPage() {
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
              href="/"
              className="text-text-secondary hover:text-amber-glow transition-colors text-sm"
            >
              Home
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl text-text-primary mb-8">
              <span className="text-amber-glow">About</span>
            </h1>
          </motion.div>

          {/* Pipeline Overview */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="mb-12"
          >
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
              The Pipeline
            </h2>
            <p className="text-text-secondary leading-relaxed mb-6">
              Converting a chess screenshot to FEN notation involves two main stages:
              detecting the board boundaries, then recognizing each piece on the 64 squares.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  step: '1',
                  title: 'Board Detection',
                  desc: 'Gradient projection finds the 8x8 grid lines',
                  color: 'bg-amber-glow/20 border-amber-glow/40',
                },
                {
                  step: '2',
                  title: 'Piece Recognition',
                  desc: 'CNN ensemble classifies each of the 64 squares',
                  color: 'bg-success/20 border-success/40',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`p-5 rounded-xl border ${item.color} backdrop-blur-sm`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 rounded-full bg-bg-deep flex items-center justify-center text-amber-glow font-bold">
                      {item.step}
                    </span>
                    <h3 className="text-text-primary font-medium">{item.title}</h3>
                  </div>
                  <p className="text-text-secondary text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Board Detection */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-12"
          >
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
              Board Detection via Gradient Projection
            </h2>
            <div className="bg-bg-surface rounded-xl p-6 border border-amber-glow/10">
              <p className="text-text-secondary leading-relaxed mb-4">
                The board detection pipeline is adapted from{' '}
                <a href="https://github.com/kratos606/chessboard-recogniser" target="_blank" rel="noopener noreferrer" className="text-amber-glow hover:underline">
                  kratos606/chessboard-recogniser
                </a>
                , which uses gradient projection to locate chessboard grid lines.
                The key insight is that grid lines produce both dark-to-light and light-to-dark
                transitions, while piece edges typically only have one direction.
              </p>

              <h3 className="text-text-primary font-medium mb-3 text-sm uppercase tracking-wide">Core algorithm (from kratos606)</h3>
              <ol className="space-y-3 text-text-secondary text-sm mb-6">
                <li className="flex gap-3">
                  <span className="text-amber-glow font-mono">1.</span>
                  <span><strong className="text-text-primary">Large Sobel kernels (31×31)</strong> — highlight grid edges while suppressing piece detail</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-glow font-mono">2.</span>
                  <span><strong className="text-text-primary">Positive × negative gradient product</strong> — sum positive and negative gradients separately along each axis, then multiply. Only real grid lines produce strong peaks</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-glow font-mono">3.</span>
                  <span><strong className="text-text-primary">Adaptive thresholding + skeletonisation</strong> — Gaussian blur and 1D non-maximum suppression to find peak positions</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-glow font-mono">4.</span>
                  <span><strong className="text-text-primary">Line pruning</strong> — find 7 equally-spaced interior lines per axis, then extend outward to get the full board edges</span>
                </li>
              </ol>

              <h3 className="text-text-primary font-medium mb-3 text-sm uppercase tracking-wide">Our additions</h3>
              <ul className="space-y-3 text-text-secondary text-sm">
                <li className="flex gap-3">
                  <span className="text-success">●</span>
                  <span><strong className="text-text-primary">Contour-based pre-crop</strong> — kratos606&apos;s pipeline assumes the board dominates the image. We added a contour-based isolation step (Canny edges, morphological closing, multiple contour strategies) that locates the board region first, so it works on real screenshots with browser chrome, sidebars, eval bars, and move lists</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-success">●</span>
                  <span><strong className="text-text-primary">Relative tolerance</strong> — spacing validation scales with detected grid spacing (6% of step) instead of a fixed pixel threshold</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-success">●</span>
                  <span><strong className="text-text-primary">Missing line interpolation</strong> — when only 6 lines are found with one double-gap, the 7th is interpolated</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-success">●</span>
                  <span><strong className="text-text-primary">Threshold refinement</strong> — when a match is found at a low threshold, the next level is also checked to filter weak spurious edges (e.g. evaluation bars)</span>
                </li>
              </ul>
            </div>
          </motion.section>

          {/* Piece Recognition */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mb-12"
          >
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
              Piece Recognition with CNNs
            </h2>
            <div className="bg-bg-surface rounded-xl p-6 border border-amber-glow/10">
              <p className="text-text-secondary leading-relaxed mb-4">
                Once the board is cropped, each of the 64 squares is resized to 40×40 pixels and
                fed through a convolutional neural network ensemble.
              </p>
              <ul className="space-y-2 text-text-secondary text-sm">
                <li className="flex gap-3">
                  <span className="text-success">●</span>
                  <span><strong className="text-text-primary">13 classes:</strong> 6 white pieces + 6 black pieces + empty square</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-success">●</span>
                  <span><strong className="text-text-primary">Ensemble of 3 models:</strong> trained with K-fold cross-validation for robustness</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-success">●</span>
                  <span><strong className="text-text-primary">Weighted loss:</strong> compensates for class imbalance (empty squares are most common)</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-success">●</span>
                  <span><strong className="text-text-primary">100% board-level accuracy</strong> on the test set (5,000 boards / 320,000 squares)</span>
                </li>
              </ul>
            </div>
          </motion.section>

          {/* Tech Stack */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mb-12"
          >
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
              Tech Stack
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'OpenCV', desc: 'Image processing' },
                { name: 'TensorFlow', desc: 'Neural networks' },
                { name: 'FastAPI', desc: 'Backend API' },
                { name: 'Next.js', desc: 'Frontend' },
              ].map((tech, i) => (
                <div
                  key={i}
                  className="bg-bg-elevated rounded-xl p-4 text-center border border-text-muted/10"
                >
                  <div className="text-text-primary font-medium mb-1">{tech.name}</div>
                  <div className="text-text-muted text-xs">{tech.desc}</div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* The Story */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
              The Story
            </h2>
            <div className="bg-bg-surface rounded-xl p-6 border border-amber-glow/10 space-y-4">
              <p className="text-text-secondary leading-relaxed">
                I play chess, and when I watch chess videos I often see positions I want to
                explore further — try different moves, run engine analysis, understand why a
                line works. But the only option was to manually set up the pieces on Lichess
                or Chess.com, square by square.
              </p>
              <p className="text-text-secondary leading-relaxed">
                Having some experience with machine learning, I wondered: could I build something
                that takes a screenshot and gives me the position instantly? And could it actually
                hit 100% accuracy, so I never have to double-check the output?
              </p>
              <p className="text-text-secondary leading-relaxed">
                I built this project with the help of{' '}
                <a href="https://claude.ai/claude-code" target="_blank" rel="noopener noreferrer" className="text-amber-glow hover:underline">
                  Claude Code
                </a>
                . The board detection is adapted from{' '}
                <a href="https://github.com/kratos606/chessboard-recogniser" target="_blank" rel="noopener noreferrer" className="text-amber-glow hover:underline">
                  kratos606&apos;s chessboard-recogniser
                </a>
                {' '}(gradient projection, skeletonisation, line pruning), and we added contour-based
                pre-crop, relative tolerance, missing line interpolation, and threshold refinement
                to make it work on real-world screenshots. For piece recognition, I trained a CNN
                ensemble on the{' '}
                <a href="https://www.kaggle.com/datasets/koryakinp/chess-positions" target="_blank" rel="noopener noreferrer" className="text-amber-glow hover:underline">
                  Chess Positions
                </a>
                {' '}dataset by Pavel Koryakin — 20,000 boards for training and 5,000 for
                testing (1,600,000 squares total) with FEN labels. The final ensemble
                achieves 100% board-level accuracy on the test set — every single board out of
                5,000 identified correctly.
              </p>
              <p className="text-text-secondary leading-relaxed">
                Now I just screenshot, upload, and I&apos;m analysing the position in seconds.
              </p>
              <p className="text-text-muted text-sm mt-2">
                —{' '}
                <a href="https://github.com/mohnatz" target="_blank" rel="noopener noreferrer" className="hover:text-amber-glow transition-colors">
                  mohnatz
                </a>
              </p>
            </div>
          </motion.section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-glow/10 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-text-muted">
          <span>Created by <a href="https://github.com/mohnatz" target="_blank" rel="noopener noreferrer" className="hover:text-amber-glow transition-colors">mohnatz</a> for educational purposes</span>
          <Link href="/" className="hover:text-amber-glow transition-colors">
            ← Back to app
          </Link>
        </div>
      </footer>
    </div>
  );
}
