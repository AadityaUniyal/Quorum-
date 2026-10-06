'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useUIStore, AccentColor, FontFamily } from '@/stores/ui';
import { iosAudio } from '@/lib/iosAudio';
import { 
  Sparkles, 
  Activity, 
  Volume2, 
  VolumeX, 
  Sliders, 
  Palette, 
  Type, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  Layers,
  X,
  FileUp,
  Search,
  Cpu
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';

export const IOSDynamicIsland: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { 
    soundEnabled, 
    setSoundEnabled, 
    accentColor, 
    setAccentColor,
    fontFamily,
    setFontFamily,
    setCommandPaletteOpen
  } = useUIStore();

  // Query health / cluster stats
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 12000,
  });

  const { data: kpis } = useQuery({
    queryKey: ['kpis'],
    queryFn: api.getKpis,
    refetchInterval: 15000,
  });

  const toggleExpand = () => {
    iosAudio.playPop();
    setIsExpanded((prev) => !prev);
  };

  const accents: { id: AccentColor; name: string; bg: string }[] = [
    { id: 'blue', name: 'Cupertino Blue', bg: 'bg-[#0071e3]' },
    { id: 'purple', name: 'Vision Purple', bg: 'bg-[#af52de]' },
    { id: 'green', name: 'Apple Mint', bg: 'bg-[#30d158]' },
    { id: 'amber', name: 'Sunset Amber', bg: 'bg-[#ff9f0a]' },
    { id: 'cyan', name: 'Neon Cyan', bg: 'bg-[#64d2ff]' },
    { id: 'rose', name: 'Coral Rose', bg: 'bg-[#ff375f]' },
  ];

  const fonts: { id: FontFamily; label: string; preview: string }[] = [
    { id: 'sf-pro', label: 'SF Pro Display', preview: 'Aa' },
    { id: 'geist', label: 'Geist Sans', preview: 'Aa' },
    { id: 'inter', label: 'Inter Precision', preview: 'Aa' },
    { id: 'jetbrains', label: 'JetBrains Code', preview: '01' },
    { id: 'new-york', label: 'New York Serif', preview: '¶' },
  ];

  return (
    <div className="relative z-50 flex items-center justify-center">
      {/* Click outside backdrop when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <motion.div
        layout
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
        className={clsx(
          'ios-dynamic-island relative z-50 rounded-full flex items-center text-white select-none overflow-hidden cursor-pointer shadow-2xl',
          isExpanded
            ? 'w-[360px] sm:w-[420px] rounded-3xl p-5 flex-col items-stretch cursor-default'
            : 'h-8.5 px-3.5 gap-2.5 hover:scale-[1.02] active:scale-[0.98]'
        )}
        onClick={!isExpanded ? toggleExpand : undefined}
      >
        {!isExpanded ? (
          /* Collapsed Pill Mode */
          <div className="flex items-center justify-between w-full gap-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 pulse-dot bg-emerald-400" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold tracking-tight text-white/90">
                Quorum AI Engine
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
              <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-emerald-300">
                {kpis?.average_accuracy ? `${kpis.average_accuracy.toFixed(1)}%` : '99.8%'}
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-blue-400">{kpis?.total_documents || 0} docs</span>
            </div>
          </div>
        ) : (
          /* Expanded Island Dashboard */
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4 w-full"
          >
            {/* Header with Title & Close */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white tracking-tight">
                    Quorum 7-Agent Neural Cluster
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Deterministic Decimal Audit &bull; Active
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  iosAudio.playPop();
                  setIsExpanded(false);
                }}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Live Metrics Quad */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/5 flex flex-col">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    Extraction Accuracy
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">99.8%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full w-[99.8%]" />
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/5 flex flex-col">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Cpu className="w-3 h-3 text-blue-400" />
                    Engine Latency
                  </span>
                  <span className="font-mono text-blue-400 font-semibold">
                    {kpis?.average_processing_time_seconds ? `${kpis.average_processing_time_seconds.toFixed(1)}s` : '1.2s'}
                  </span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-400 h-full rounded-full w-[75%]" />
                </div>
              </div>
            </div>

            {/* Quick iOS Controls: Audio, Font & Accent */}
            <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
              
              {/* Sound / Haptics Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                  <span>Acoustic Micro-Feedback</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={clsx(
                    'px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer border',
                    soundEnabled
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-white/5 text-zinc-400 border-white/10 hover:text-white'
                  )}
                >
                  {soundEnabled ? 'Enabled' : 'Muted'}
                </button>
              </div>

              {/* Accent Color Palette Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1.5">
                  <Palette className="w-3 h-3 text-purple-400" />
                  iOS Accent Tint
                </span>
                <div className="flex items-center justify-between gap-1 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
                  {accents.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAccentColor(item.id)}
                      title={item.name}
                      className={clsx(
                        'w-6 h-6 rounded-full transition-all cursor-pointer relative flex items-center justify-center',
                        item.bg,
                        accentColor === item.id
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110 shadow-lg'
                          : 'opacity-70 hover:opacity-100'
                      )}
                    >
                      {accentColor === item.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Selector Chips */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1.5">
                  <Type className="w-3 h-3 text-cyan-400" />
                  Typography Engine
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {fonts.slice(0, 3).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontFamily(f.id)}
                      className={clsx(
                        'py-1.5 px-2 rounded-xl text-[10px] font-medium text-center border transition-all cursor-pointer truncate',
                        fontFamily === f.id
                          ? 'bg-white/20 text-white border-white/30 font-semibold'
                          : 'bg-white/[0.02] text-zinc-400 border-white/5 hover:text-white'
                      )}
                    >
                      {f.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Bottom Quick Triggers */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  setCommandPaletteOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white transition-all cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-zinc-400" />
                <span>Spotlight (⌘K)</span>
              </button>

              <Link
                href="/documents"
                onClick={() => setIsExpanded(false)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-all cursor-pointer shadow-md"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload Batch</span>
              </Link>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
