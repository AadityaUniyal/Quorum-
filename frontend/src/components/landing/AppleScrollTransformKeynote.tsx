'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ShieldCheck, CheckCircle2, FileText, ArrowRight, Zap, Scale, Layers } from 'lucide-react';
import clsx from 'clsx';

export const AppleScrollTransformKeynote: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Scroll Progress across the long transform container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Smooth spring physics for Apple-like fluid feel
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 25,
    restDelta: 0.0001,
  });

  // Stage 1: Big Headline Transforms: "Precision." -> "Without compromise." -> "Verified in milliseconds."
  const title1Opacity = useTransform(smoothProgress, [0.0, 0.15, 0.28], [1, 1, 0]);
  const title1Scale = useTransform(smoothProgress, [0.0, 0.28], [1, 0.85]);
  const title1Y = useTransform(smoothProgress, [0.0, 0.28], [0, -50]);

  const title2Opacity = useTransform(smoothProgress, [0.25, 0.35, 0.55], [0, 1, 0]);
  const title2Scale = useTransform(smoothProgress, [0.25, 0.35, 0.55], [0.85, 1, 0.85]);
  const title2Y = useTransform(smoothProgress, [0.25, 0.35, 0.55], [50, 0, -50]);

  const title3Opacity = useTransform(smoothProgress, [0.52, 0.62, 0.82], [0, 1, 0]);
  const title3Scale = useTransform(smoothProgress, [0.52, 0.62, 0.82], [0.85, 1, 0.85]);
  const title3Y = useTransform(smoothProgress, [0.52, 0.62, 0.82], [50, 0, -50]);

  const title4Opacity = useTransform(smoothProgress, [0.78, 0.88, 1.0], [0, 1, 1]);
  const title4Scale = useTransform(smoothProgress, [0.78, 0.88, 1.0], [0.85, 1, 1]);
  const title4Y = useTransform(smoothProgress, [0.78, 0.88, 1.0], [50, 0, 0]);

  // Optical Hardware Glass Card Transformation (scale from miniature preview into full widescreen viewport)
  const mockupScale = useTransform(smoothProgress, [0.1, 0.7], [0.88, 1.02]);
  const mockupRotateX = useTransform(smoothProgress, [0.1, 0.6], [12, 0]);
  const mockupOpacity = useTransform(smoothProgress, [0.05, 0.2], [0.4, 1]);

  return (
    <div ref={containerRef} className="relative h-[360vh] bg-black text-white">
      {/* Sticky Viewport Container */}
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8">
        
        {/* Subtle Ambient Radial Lighting (Apple Titanium Tone, Not Cyber Neon) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-zinc-800/20 via-blue-900/10 to-transparent rounded-full blur-[140px] pointer-events-none" />

        {/* Dynamic Kinetic Typography Centerpiece */}
        <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center justify-center text-center">
          
          {/* Phase 1: Precision */}
          <motion.div
            style={{ opacity: title1Opacity, scale: title1Scale, y: title1Y }}
            className="absolute flex flex-col items-center justify-center pointer-events-none"
          >
            <span className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-zinc-400 uppercase mb-4">
              Autonomous Verification OS
            </span>
            <h2 className="text-5xl sm:text-7xl md:text-8xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500">
              Precision.
            </h2>
            <p className="mt-4 text-base sm:text-xl text-zinc-400 max-w-xl font-light">
              Every invoice, contract, and balance sheet verified to the exact coordinate.
            </p>
          </motion.div>

          {/* Phase 2: Zero Hallucination */}
          <motion.div
            style={{ opacity: title2Opacity, scale: title2Scale, y: title2Y }}
            className="absolute flex flex-col items-center justify-center pointer-events-none"
          >
            <span className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-blue-400 uppercase mb-4">
              Deterministic Math Engine
            </span>
            <h2 className="text-5xl sm:text-7xl md:text-8xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400">
              Zero Drift.
            </h2>
            <p className="mt-4 text-base sm:text-xl text-zinc-400 max-w-xl font-light">
              LLMs estimate. Quorum recalculates every decimal down to the cent with absolute mathematical certainty.
            </p>
          </motion.div>

          {/* Phase 3: Spatial Provenance */}
          <motion.div
            style={{ opacity: title3Opacity, scale: title3Scale, y: title3Y }}
            className="absolute flex flex-col items-center justify-center pointer-events-none"
          >
            <span className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-emerald-400 uppercase mb-4">
              2D Coordinate Anchoring
            </span>
            <h2 className="text-5xl sm:text-7xl md:text-8xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-400">
              100% Provenance.
            </h2>
            <p className="mt-4 text-base sm:text-xl text-zinc-400 max-w-xl font-light">
              Hover any extracted dollar figure to reveal its exact bounding box on the original document in real-time.
            </p>
          </motion.div>

          {/* Phase 4: Full Enterprise Harmony */}
          <motion.div
            style={{ opacity: title4Opacity, scale: title4Scale, y: title4Y }}
            className="absolute flex flex-col items-center justify-center"
          >
            <span className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-zinc-400 uppercase mb-4">
              Direct ERP Integration
            </span>
            <h2 className="text-5xl sm:text-7xl md:text-8xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-400">
              Instant Dispatch.
            </h2>
            <p className="mt-4 text-base sm:text-xl text-zinc-400 max-w-xl font-light">
              1-click certified journal entry push directly to SAP S/4HANA, NetSuite, and QuickBooks.
            </p>
          </motion.div>
        </div>

        {/* Apple-Style Titanium Glass Viewport Mockup (Below Typography) */}
        <motion.div
          style={{
            scale: mockupScale,
            rotateX: mockupRotateX,
            opacity: mockupOpacity,
            perspective: '1200px',
          }}
          className="relative z-0 mt-36 w-full max-w-4xl rounded-2xl p-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent shadow-[0_25px_80px_rgba(0,0,0,0.9)]"
        >
          <div className="rounded-2xl bg-[#0d0d11]/90 backdrop-blur-2xl border border-white/10 overflow-hidden">
            {/* macOS Chrome Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]/80 border border-[#e0443e]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]/80 border border-[#dea123]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]/80 border border-[#1aab29]" />
                <span className="ml-3 text-[11px] font-medium text-zinc-400 tracking-wide">
                  Quorum OS — Verification Terminal
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> 7/7 Consensus Verified
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Δ == $0.00</span>
              </div>
            </div>

            {/* Mockup Body Content */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 text-left font-sans">
              {/* Left: Document Spatial Viewport */}
              <div className="md:col-span-6 bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-3 font-medium">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-400" /> INV-2026-9042.pdf
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">1000 × 1000 Grid</span>
                  </div>
                  <div className="relative rounded-lg bg-zinc-900/60 p-3 border border-white/5 space-y-2">
                    <div className="h-3 w-1/3 bg-white/10 rounded" />
                    <div className="h-2 w-1/2 bg-white/5 rounded" />
                    <div className="my-3 border-t border-white/5" />
                    {/* Simulated Bounding Box */}
                    <div className="p-2 rounded bg-blue-500/10 border border-blue-500/40 relative">
                      <div className="text-[10px] text-blue-300 font-mono flex justify-between">
                        <span>Total Due: $48,920.00</span>
                        <span className="text-zinc-500">[x: 640, y: 820]</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>OCR Engine: Vision v2</span>
                  <span className="text-emerald-400 font-medium">Coordinate Grounded</span>
                </div>
              </div>

              {/* Right: Agent Audit Verdicts */}
              <div className="md:col-span-6 space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-xs font-semibold text-zinc-200 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-emerald-400" /> Auditor Agent
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">100% Match</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Line multiplications (14 items) recalculated. Subtotal \$44,880.73 + Tax \$4,039.27 == \$48,920.00.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-xs font-semibold text-zinc-200 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Critic & Compliance
                    </span>
                    <span className="text-[10px] text-blue-400 font-mono">Verified</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Cross-referenced vendor EIN with corporate database. Zero duplicate invoice detected.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-zinc-300 font-medium">Dispatch Target</span>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">SAP S/4HANA Ledger #9021</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scroll Indicator at bottom */}
        <div className="absolute bottom-6 flex flex-col items-center gap-2 pointer-events-none">
          <span className="text-[10px] tracking-widest uppercase text-zinc-500 font-mono">
            Scroll to experience Quorum
          </span>
          <div className="w-4 h-7 rounded-full border border-white/20 flex justify-center p-1">
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              className="w-1 h-1.5 bg-white/60 rounded-full"
            />
          </div>
        </div>

      </div>
    </div>
  );
};
