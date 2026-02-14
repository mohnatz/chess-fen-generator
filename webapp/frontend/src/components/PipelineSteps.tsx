'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface PipelineStep {
  key: string;
  title: string;
  description: string;
  image_base64: string | null;
}

interface PipelineStepsProps {
  file: File;
}

export default function PipelineSteps({ file }: PipelineStepsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);

    // Only fetch if we haven't already
    if (steps) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/predict/pipeline`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to load pipeline data');
      }

      const data = await response.json();
      setSteps(data.steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-amber-glow/10">
      <button
        onClick={handleToggle}
        className="w-full px-6 py-4 flex items-center justify-between text-left
                   hover:bg-bg-elevated/30 transition-colors duration-200"
      >
        <span className="text-text-secondary text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-glow/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          How was this detected?
        </span>
        <svg
          className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3 text-text-muted text-sm">
                    <motion.div
                      className="w-5 h-5 border-2 border-amber-glow/30 border-t-amber-glow rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    Loading pipeline visualization...
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-center">
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}

              {steps && steps.map((step, index) => (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.3 }}
                  className="bg-bg-elevated rounded-xl overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-glow/15 flex items-center justify-center">
                        <span className="text-amber-glow text-xs font-bold">{index + 1}</span>
                      </span>
                      <div>
                        <h3 className="text-text-primary text-sm font-medium">{step.title}</h3>
                        <p className="text-text-secondary text-xs mt-1 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                    {step.image_base64 && (
                      <div className="mt-3 ml-9">
                        <img
                          src={step.image_base64}
                          alt={step.title}
                          className="w-full max-w-lg rounded-lg border border-text-muted/10"
                        />
                      </div>
                    )}
                    {!step.image_base64 && step.key === 'classification' && (
                      <div className="mt-3 ml-9 flex items-center gap-2 text-text-muted text-xs">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        64 squares classified by CNN
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
