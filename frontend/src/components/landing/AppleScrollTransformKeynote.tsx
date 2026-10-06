'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Zap,
  Scale,
  Sparkles,
  Search,
  CheckCircle,
  Clock,
  ArrowRight,
  Layers
} from 'lucide-react';
import clsx from 'clsx';
import { iosAudio } from '@/lib/iosAudio';

interface KeynoteStage {
  id: number;
  tag: string;
  badge: string;
  title: string;
  subtitle: string;
  metrics: { label: string; value: string }[];
  highlightSection: 'ocr' | 'math' | 'provenance' | 'erp';
}

const stages: KeynoteStage[] = [
  {
    id: 0,
    tag: 'Autonomous Verification OS',
    badge: 'Spatial Vision Core',
    title: 'Precision.',
    subtitle: 'Every invoice, contract, and balance sheet mapped to normalized 1000 × 1000 coordinates before inference.',
    metrics: [
      { label: 'Ingestion Latency', value: '< 380ms' },
      { label: 'Spatial Resolution', value: '1000 × 1000' },
      { label: 'OCR Grounding', value: '100% Native' }
    ],
    highlightSection: 'ocr'
  },
  {
    id: 1,
    tag: 'Deterministic Math Engine',
    badge: 'Arithmetic Guarantee',
    title: 'Zero Drift.',
    subtitle: 'LLMs estimate tokens. Quorum recomputes all quantity × price multiplications down to the exact cent.',
    metrics: [
      { label: 'Math Delta', value: 'Δ == $0.00' },
      { label: 'Rounding Errors Caught', value: '100%' },
      { label: 'Tax Precision', value: 'Exact Decimal' }
    ],
    highlightSection: 'math'
  },
  {
    id: 2,
    tag: '2D Coordinate Anchoring',
    badge: 'Spatial Provenance',
    title: '100% Provenance.',
    subtitle: 'Hover any extracted dollar figure to illuminate its exact bounding box on the original document.',
    metrics: [
      { label: 'Audit Time Saved', value: '92%' },
      { label: 'Confidence Score', value: '99.8%' },
      { label: 'Traceability', value: 'Bidirectional' }
    ],
    highlightSection: 'provenance'
  },
  {
    id: 3,
    tag: 'Direct ERP Integration',
    badge: 'Certified Accounting',
    title: 'Instant Dispatch.',
    subtitle: '1-click certified journal entry push directly to SAP S/4HANA, NetSuite, and QuickBooks with audit hashes.',
    metrics: [
      { label: 'Ledger Post Time', value: '< 1.2s' },
      { label: 'Cryptographic Hash', value: 'SHA-256' },
      { label: 'Compliance Status', value: 'SOX Ready' }
    ],
    highlightSection: 'erp'
  }
];

export const AppleScrollTransformKeynote: React.FC = () => {
  const [activeStage, setActiveStage] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Auto-advance stages every 5 seconds unless paused by user interaction
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const selectStage = (idx: number) => {
    iosAudio.playSwitch(true);
    setActiveStage(idx);
    setIsPaused(true);
  };

  const current = stages[activeStage];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full text-white select-none"
    >
      {/* Subtle Ambient Radial Lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] h-[350px] bg-gradient-to-tr from-blue-900/15 via-zinc-800/10 to-transparent rounded-full blur-[140px] pointer-events-none" />

      {/* ── TOP: INTERACTIVE STAGE STEPPER PILLS ─────────────────────────── */}
      <div className="relative z-20 w-full max-w-3xl mx-auto flex flex-col items-center mb-8">
        <div className="p-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-2xl inline-flex items-center gap-1 shadow-lg">
          {stages.map((stage, idx) => {
            const isActive = activeStage === idx;
            return (
              <button
                key={stage.id}
                onClick={() => selectStage(idx)}
                className={clsx(
                  "px-3.5 sm:px-5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-2 cursor-pointer select-none touch-press",
                  isActive
                    ? "bg-white text-black shadow-md font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                )}
              >
                <span className={clsx("font-mono text-[10px]", isActive ? "text-zinc-900 font-bold" : "text-zinc-500")}>
                  0{idx + 1}
                </span>
                <span className="hidden sm:inline">{stage.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CENTER: DYNAMIC KINETIC TYPOGRAPHY + HARDWARE CANVAS ──────────── */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center gap-8">
        
        {/* Kinetic Headline Crossfade */}
        <div className="text-center max-w-2xl mx-auto min-h-[100px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex flex-col items-center"
            >
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-zinc-300 font-medium tracking-wide mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>{current.tag}</span>
              </div>
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400">
                {current.title}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-zinc-400 max-w-xl font-light leading-relaxed">
                {current.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Titanium Hardware Viewport Mockup */}
        <div className="w-full max-w-4xl rounded-3xl p-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent shadow-[0_24px_70px_rgba(0,0,0,0.85)]">
          <div className="rounded-3xl bg-[#0b0b0e]/95 backdrop-blur-3xl border border-white/10 overflow-hidden">
            
            {/* macOS Window Chrome */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/80 border border-[#e0443e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/80 border border-[#dea123]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]/80 border border-[#1aab29]" />
                <span className="ml-2 text-[11px] font-medium text-zinc-400 tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-blue-400" /> Quorum OS Verification Console
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  <CheckCircle2 className="w-3 h-3" /> Consensus Certified
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Δ == $0.00</span>
              </div>
            </div>

            {/* Keynote Content Grid */}
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 text-left font-sans">
              
              {/* Left Side: Spatial Document Viewport */}
              <div className="md:col-span-6 bg-black/60 rounded-2xl p-4 border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-3 font-medium">
                    <span className="flex items-center gap-1.5 text-zinc-200">
                      <FileText className="w-3.5 h-3.5 text-blue-400" /> INV-2026-9042.pdf
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">1000 × 1000 Spatial Grid</span>
                  </div>

                  <div className="relative rounded-xl bg-zinc-950 p-3.5 border border-white/5 space-y-2.5 overflow-hidden">
                    <div className="h-2.5 w-1/3 bg-white/15 rounded" />
                    <div className="h-2 w-1/2 bg-white/10 rounded" />
                    <div className="my-2 border-t border-white/5" />
                    
                    {/* Active Stage Interactive Overlay */}
                    <div className={clsx(
                      "p-3 rounded-xl transition-all duration-300 relative",
                      current.highlightSection === 'ocr' && "bg-blue-500/15 border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]",
                      current.highlightSection === 'math' && "bg-amber-500/15 border border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]",
                      current.highlightSection === 'provenance' && "bg-emerald-500/15 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
                      current.highlightSection === 'erp' && "bg-purple-500/15 border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                    )}>
                      <div className="text-[11px] font-mono flex items-center justify-between text-zinc-200">
                        <span className="font-semibold">Billed Total: $48,920.00</span>
                        <span className="text-[10px] text-zinc-400 font-mono">[x: 640, y: 820]</span>
                      </div>
                      <div className="mt-1.5 text-[10px] text-zinc-400 flex items-center justify-between font-mono">
                        <span>Subtotal: $44,880.73</span>
                        <span>Tax (9%): $4,039.27</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Search className="w-3 h-3 text-zinc-400" /> Vision v2 Layout Model
                  </span>
                  <span className="text-emerald-400 font-medium">100% Coordinate Grounded</span>
                </div>
              </div>

              {/* Right Side: Multi-Agent Consensus Cards */}
              <div className="md:col-span-6 flex flex-col justify-between gap-3">
                <div className="space-y-2.5">
                  {/* Auditor Agent */}
                  <div className={clsx(
                    "p-3 rounded-2xl border transition-all duration-300",
                    current.highlightSection === 'math'
                      ? "bg-amber-500/10 border-amber-500/40 shadow-sm"
                      : "bg-white/[0.02] border-white/5"
                  )}>
                    <div className="text-xs font-semibold text-zinc-200 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-amber-400" /> Auditor Agent
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">Δ == $0.00</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight font-light">
                      14 line items recalculated: \$44,880.73 + \$4,039.27 == \$48,920.00. 100% deterministic decimal precision.
                    </p>
                  </div>

                  {/* Compliance & Critic */}
                  <div className={clsx(
                    "p-3 rounded-2xl border transition-all duration-300",
                    current.highlightSection === 'provenance'
                      ? "bg-emerald-500/10 border-emerald-500/40 shadow-sm"
                      : "bg-white/[0.02] border-white/5"
                  )}>
                    <div className="text-xs font-semibold text-zinc-200 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Critic &amp; Compliance Agent
                      </span>
                      <span className="text-[10px] text-blue-400 font-mono">99.8% Match</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight font-light">
                      Vendor EIN &amp; banking details verified. 2D coordinates anchored to canvas with zero drift.
                    </p>
                  </div>

                  {/* ERP Dispatch Target */}
                  <div className={clsx(
                    "p-3 rounded-2xl border transition-all duration-300",
                    current.highlightSection === 'erp'
                      ? "bg-purple-500/10 border-purple-500/40 shadow-sm"
                      : "bg-white/[0.02] border-white/5"
                  )}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                        <Zap className="w-3.5 h-3.5 text-purple-400" />
                        <span>SAP S/4HANA Ledger #9021</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">READY TO POST</span>
                    </div>
                  </div>
                </div>

                {/* Stage Metrics Row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
                  {current.metrics.map((m, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="text-[10px] text-zinc-400">{m.label}</div>
                      <div className="text-xs font-bold text-white font-mono mt-0.5">{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
