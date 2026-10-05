'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Command, Keyboard } from 'lucide-react';

export const KeyboardShortcutsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const shortcuts = [
    { category: 'Navigation', items: [
      { key: 'Cmd + K', desc: 'Open Command Palette & Global Search' },
      { key: 'J / K', desc: 'Next / Previous Document in Review Queue' },
      { key: 'G + D', desc: 'Go to Operations Dashboard' },
      { key: 'G + R', desc: 'Go to Spatial Review Studio' },
      { key: 'G + S', desc: 'Go to System Settings' },
    ]},
    { category: 'Spatial Review Studio', items: [
      { key: 'A', desc: 'Approve Document & Certified Ledger Dispatch' },
      { key: 'R', desc: 'Flag for Arithmetic / Compliance Rework' },
      { key: 'F', desc: 'Toggle Fullscreen Document Canvas' },
      { key: '+ / -', desc: 'Zoom In / Zoom Out on 2D Bounding Boxes' },
      { key: '0', desc: 'Reset Canvas Zoom to Fit Width' },
    ]},
    { category: 'Global Controls', items: [
      { key: '?', desc: 'Toggle Keyboard Shortcuts Sheet' },
      { key: 'Esc', desc: 'Close Active Modal / Slide-over Panel' },
      { key: 'U', desc: 'Open Batch Document Upload Drawer' },
    ]}
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-2xl rounded-3xl bg-[#121217]/95 border border-white/15 p-6 shadow-2xl backdrop-blur-3xl z-10 text-white"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                  <Keyboard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Keyboard Shortcuts</h3>
                  <p className="text-xs text-zinc-400">Power-user navigation and spatial review controls</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
              {shortcuts.map((section) => (
                <div key={section.category} className="space-y-3">
                  <div className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase font-mono">
                    {section.category}
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <div key={item.key} className="flex flex-col gap-0.5">
                        <kbd className="self-start px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[11px] font-mono text-zinc-200 shadow-sm">
                          {item.key}
                        </kbd>
                        <span className="text-[11px] text-zinc-400 leading-tight mt-0.5">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Esc</kbd> to dismiss</span>
              <span className="font-mono text-blue-400">Quorum OS Core</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
