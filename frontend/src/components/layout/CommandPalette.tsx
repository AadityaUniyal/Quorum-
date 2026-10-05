'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/stores/ui';
import {
  Search,
  FileText,
  BarChart2,
  Shield,
  Settings,
  Bot,
  RefreshCw,
  DollarSign,
  Activity,
  Layers,
  ArrowRight,
  Sparkles,
  Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const CommandPalette: React.FC = () => {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Register global ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      } else if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // All 11 core routes configured for fast navigation
  const commands = [
    { name: 'Landing Page & Keynote Studio', icon: Home, href: '/', category: 'Core' },
    { name: 'Executive Operations Dashboard', icon: BarChart2, href: '/dashboard', category: 'Core' },
    { name: 'Document Library & Uploads', icon: FileText, href: '/documents', category: 'Documents' },
    { name: '7-Agent Audit & Review Workspace', icon: Bot, href: '/review', category: 'Verification' },
    { name: 'Semantic Search & Vector RAG Copilot', icon: Search, href: '/search', category: 'Intelligence' },
    { name: 'Spend & Variance Analytics', icon: Activity, href: '/analytics', category: 'Intelligence' },
    { name: 'Web Crawler Ingestion Core', icon: RefreshCw, href: '/crawl', category: 'System' },
    { name: 'Benchmark & Accuracy Matrix', icon: Layers, href: '/benchmarks', category: 'System' },
    { name: 'Subscription & Pricing Tiers', icon: DollarSign, href: '/pricing', category: 'Account' },
    { name: 'Enterprise Admin Console', icon: Shield, href: '/admin', category: 'Administration' },
    { name: 'System & ERP Integrations Settings', icon: Settings, href: '/settings', category: 'Administration' },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (href: string) => {
    setCommandPaletteOpen(false);
    setQuery('');
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredCommands[selectedIndex].href);
    }
  };

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          {/* Spring physics backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => setCommandPaletteOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-2xl"
          />

          {/* Spring physics palette panel in Apple Obsidian Titanium */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -16 }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            className="relative w-full max-w-xl rounded-3xl bg-[#0A0A0C]/95 border border-white/[0.12] shadow-[0_32px_80px_rgba(0,0,0,0.9)] backdrop-blur-3xl overflow-hidden z-10 text-white font-sans select-none"
          >
            {/* Search Input Bar */}
            <div className="p-4 border-b border-white/[0.08] flex items-center gap-3 bg-white/[0.02]">
              <Search className="w-4 h-4 text-[#0071e3] shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search actions, documents, or navigation (↑↓ to move, Enter to run)..."
                className="w-full bg-transparent text-sm text-[#f5f5f7] placeholder-[#86868b] focus:outline-none tracking-tight font-light"
                autoFocus
              />
              <kbd className="px-2 py-0.5 text-[10px] uppercase font-mono bg-white/[0.06] border border-white/10 text-[#a1a1a6] rounded-md">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredCommands.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#86868b] font-light">
                  No matching commands found.
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = selectedIndex === idx;
                  return (
                    <button
                      key={cmd.href}
                      onClick={() => handleSelect(cmd.href)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black shadow-md'
                          : 'text-[#f5f5f7] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-black' : 'text-[#0071e3]'}`} />
                        <span>{cmd.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-black/10 text-black' : 'bg-white/[0.04] text-[#86868b] border border-white/5'
                        }`}>
                          {cmd.category}
                        </span>
                        {isSelected && <ArrowRight className="w-3.5 h-3.5 text-black" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Command Palette Footer */}
            <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-[10px] text-[#86868b] font-mono">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#0071e3]" /> Quorum OS Global Dispatch
              </span>
              <span>11 Core Routes Available</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
