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
              How It <span className="text-amber-glow">Works</span>
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
                The key insight is that chessboard grid lines produce distinctive gradient patterns.
                Each line has both a dark-to-light and light-to-dark transition (due to alternating
                square colors), while piece edges typically only have one direction.
              </p>
              <ol className="space-y-3 text-text-secondary text-sm">
                <li className="flex gap-3">
                  <span className="text-amber-glow font-mono">1.</span>
                  <span><strong className="text-text-primary">Histogram equalization</strong> — normalize contrast across different board themes</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-glow font-mono">2.</span>
                  <span><strong className="text-text-primary">Large Sobel kernels (31×31)</strong> — smooth out piece detail while preserving grid lines</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-glow font-mono">3.</span>
                  <span><strong className="text-text-primary">Positive × negative gradient product</strong> — multiply projections of opposing gradients; only grid lines peak strongly</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-amber-glow font-mono">4.</span>
                  <span><strong className="text-text-primary">Find 7 equally-spaced peaks</strong> — the interior grid lines, then extend outward to get all 9 boundaries</span>
                </li>
              </ol>
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

          {/* Backstory Placeholder */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-4">
              The Story
            </h2>
            <div className="bg-bg-surface rounded-xl p-6 border border-amber-glow/10">
              <p className="text-text-secondary leading-relaxed italic">
                {/* TODO: Add your personal backstory here */}
                This project started as an experiment in computer vision — I wanted to see if
                I could reliably detect a chessboard in arbitrary screenshots without relying
                on template matching or specific board themes. The gradient projection approach
                turned out to be surprisingly robust across different platforms (Lichess, Chess.com,
                chess24, etc.) and even works on photos of physical boards in decent lighting.
              </p>
              <p className="text-text-muted text-sm mt-4">
                — Your name here
              </p>
            </div>
          </motion.section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-amber-glow/10 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-text-muted">
          <span>Built with computer vision & neural networks</span>
          <Link href="/" className="hover:text-amber-glow transition-colors">
            ← Back to app
          </Link>
        </div>
      </footer>
    </div>
  );
}
