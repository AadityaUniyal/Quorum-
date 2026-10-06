'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, AccentColor, FontFamily } from '@/stores/ui';
import { iosAudio } from '@/lib/iosAudio';
import { IOSSwitch } from './IOSSwitch';
import { 
  Sliders, 
  X, 
  Volume2, 
  VolumeX, 
  Palette, 
  Type, 
  Sparkles, 
  ShieldCheck, 
  Target, 
  Sun, 
  Moon,
  Zap,
  Check
} from 'lucide-react';
import clsx from 'clsx';

export const IOSControlCenter: React.FC = () => {
  const {
    controlCenterOpen,
    setControlCenterOpen,
    soundEnabled,
    setSoundEnabled,
    accentColor,
    setAccentColor,
    fontFamily,
    setFontFamily,
    confidenceThreshold,
    setConfidenceThreshold,
    vectorTopK,
    setVectorTopK,
  } = useUIStore();

  if (!controlCenterOpen) return null;

  const accents: { id: AccentColor; name: string; bg: string; hex: string }[] = [
    { id: 'blue', name: 'Cupertino Blue', bg: 'bg-[#0071e3]', hex: '#0071e3' },
    { id: 'purple', name: 'Vision Purple', bg: 'bg-[#af52de]', hex: '#af52de' },
    { id: 'green', name: 'Apple Mint', bg: 'bg-[#30d158]', hex: '#30d158' },
    { id: 'amber', name: 'Sunset Amber', bg: 'bg-[#ff9f0a]', hex: '#ff9f0a' },
    { id: 'cyan', name: 'Neon Cyan', bg: 'bg-[#64d2ff]', hex: '#64d2ff' },
    { id: 'rose', name: 'Coral Rose', bg: 'bg-[#ff375f]', hex: '#ff375f' },
  ];

  const fonts: { id: FontFamily; label: string; desc: string }[] = [
    { id: 'sf-pro', label: 'SF Pro Display', desc: 'Apple standard modern sans-serif' },
    { id: 'geist', label: 'Plus Jakarta', desc: 'Sleek geometric contemporary type' },
    { id: 'inter', label: 'Inter Dynamic', desc: 'Optimized high-density UI typography' },
    { id: 'jetbrains', label: 'JetBrains Mono', desc: 'Deterministic developer monospace' },
    { id: 'new-york', label: 'New York Editorial', desc: 'Classic legal serif typography' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 pointer-events-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setControlCenterOpen(false)}
        className="fixed inset-0 bg-black/60 backdrop-blur-md pointer-events-auto"
      />

      {/* Control Center Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: -16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: -16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative w-full max-w-md rounded-3xl bg-[#0A0A0C]/95 border border-white/[0.12] shadow-[0_24px_64px_rgba(0,0,0,0.9)] backdrop-blur-3xl p-6 pointer-events-auto z-10 text-white font-sans overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-white/[0.08] text-white border border-white/10">
              <Sliders className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                iOS Control Center
              </h2>
              <p className="text-[11px] text-zinc-400">
                Display, typography, acoustic cues &amp; AI engine settings
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setControlCenterOpen(false)}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sliders Section */}
        <div className="flex flex-col gap-4 py-4 border-b border-white/10">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                OCR Confidence Threshold
              </span>
              <span className="font-mono text-xs font-semibold text-blue-400">
                {confidenceThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer h-1.5 bg-white/10 rounded-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Vector RAG Top-K Chunks
              </span>
              <span className="font-mono text-xs font-semibold text-purple-400">
                {vectorTopK} chunks
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              value={vectorTopK}
              onChange={(e) => setVectorTopK(Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer h-1.5 bg-white/10 rounded-full"
            />
          </div>
        </div>

        {/* Toggles & Sound */}
        <div className="flex flex-col gap-3 py-4 border-b border-white/10">
          <IOSSwitch
            checked={soundEnabled}
            onChange={setSoundEnabled}
            label="Acoustic Haptic Feedback"
            description="Play synthesized Apple clicks, chimes & laser sounds"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-400">Audition Test Chime</span>
            <button
              type="button"
              onClick={() => iosAudio.playSuccess()}
              className="px-3 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white border border-white/10 cursor-pointer transition-all"
            >
              Play Chime
            </button>
          </div>
        </div>

        {/* Accent Color Picker */}
        <div className="flex flex-col gap-2 py-4 border-b border-white/10">
          <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-pink-400" />
            Accent Tint Selection
          </span>
          <div className="grid grid-cols-6 gap-2">
            {accents.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAccentColor(item.id)}
                className={clsx(
                  'h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer border',
                  item.bg,
                  accentColor === item.id
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105 border-transparent shadow-lg'
                    : 'border-white/10 opacity-70 hover:opacity-100'
                )}
                title={item.name}
              >
                {accentColor === item.id && <Check className="w-4 h-4 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>

        {/* Typography Selection */}
        <div className="flex flex-col gap-2 pt-4">
          <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-cyan-400" />
            System Typography Engine
          </span>
          <div className="flex flex-col gap-1.5">
            {fonts.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFontFamily(f.id)}
                className={clsx(
                  'flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer text-left',
                  fontFamily === f.id
                    ? 'bg-white/15 border-white/25 text-white font-medium shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                )}
              >
                <div className="flex flex-col">
                  <span className="text-xs">{f.label}</span>
                  <span className="text-[10px] text-zinc-500">{f.desc}</span>
                </div>
                {fontFamily === f.id && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
