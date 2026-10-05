'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Eye, 
  Search, 
  Settings,
  BarChart3,
  Globe,
  Award,
  DollarSign,
  ShieldCheck,
  Home,
  Menu,
  X,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // All 11 core routes defined in PROJECT.md
  const allRoutes = [
    { label: 'Landing Keynote', path: '/', icon: Home, category: 'Core', desc: 'Platform story & auth' },
    { label: 'Operations Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'Core', desc: 'KPI metrics & pipeline' },
    { label: 'Document Library', path: '/documents', icon: FileText, category: 'Documents', desc: 'Batch grid & status' },
    { label: 'Spatial Review Studio', path: '/review', icon: Eye, category: 'Verification', desc: '7-agent consensus' },
    { label: 'Spend & Variance Analytics', path: '/analytics', icon: BarChart3, category: 'Intelligence', desc: 'Time series & anomalies' },
    { label: 'Vector Search & RAG', path: '/search', icon: Search, category: 'Intelligence', desc: 'Semantic queries' },
    { label: 'Crawler & Ingestion', path: '/crawl', icon: Globe, category: 'System', desc: 'Autonomous discovery' },
    { label: 'Benchmarks Matrix', path: '/benchmarks', icon: Award, category: 'System', desc: 'Accuracy & latency' },
    { label: 'Subscription & Pricing', path: '/pricing', icon: DollarSign, category: 'Account', desc: 'Enterprise tiers' },
    { label: 'System & ERP Settings', path: '/settings', icon: Settings, category: 'Administration', desc: 'Integrations & passkeys' },
    { label: 'Enterprise Admin', path: '/admin', icon: ShieldCheck, category: 'Administration', desc: 'Tenants & RBAC' },
  ];

  // Primary bottom bar shortcuts
  const primaryBarItems = [
    { label: 'Console', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Docs', path: '/documents', icon: FileText },
    { label: 'Review', path: '/review', icon: Eye },
    { label: 'Search', path: '/search', icon: Search },
  ];

  return (
    <>
      {/* Fixed Bottom Quick-Nav Bar */}
      <nav 
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0A0A0C]/95 backdrop-blur-2xl border-t border-white/[0.08] px-3 py-1.5 flex items-center justify-around select-none pb-safe"
      >
        {primaryBarItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition-all duration-150 touch-press',
                isActive 
                  ? 'text-white font-semibold' 
                  : 'text-[#86868b] hover:text-[#f5f5f7]'
              )}
            >
              <div className={clsx('p-1 rounded-lg transition-colors', isActive && 'bg-[#0071e3]/20 text-[#38bdf8]')}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* Menu Drawer Toggle Button */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          aria-expanded={isMenuOpen}
          aria-label="Open full Quorum OS route navigation"
          className={clsx(
            'flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition-all duration-150 cursor-pointer touch-press',
            isMenuOpen 
              ? 'text-white font-semibold' 
              : 'text-[#86868b] hover:text-[#f5f5f7]'
          )}
        >
          <div className={clsx('p-1 rounded-lg transition-colors', isMenuOpen && 'bg-white/15 text-white')}>
            <Menu className="h-4.5 w-4.5" />
          </div>
          <span className="text-[10px] tracking-tight">All Routes</span>
        </button>
      </nav>

      {/* Responsive Slide-Up Drawer Menu with All 11 Routes */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end">
            {/* Frosted Glass Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl"
            />

            {/* Slide-Up Navigation Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-h-[85vh] rounded-t-3xl bg-[#0A0A0C]/98 border-t border-white/[0.12] shadow-[0_-16px_48px_rgba(0,0,0,0.9)] backdrop-blur-3xl flex flex-col z-10 text-white font-sans overflow-hidden"
            >
              {/* Grab Handle */}
              <div className="pt-3 pb-1 flex justify-center">
                <div className="w-12 h-1.5 rounded-full bg-white/20" />
              </div>

              {/* Sheet Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[#0071e3]">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white tracking-tight">Quorum OS Navigation</h2>
                    <p className="text-[11px] text-[#86868b]">All 11 Enterprise Intelligence Modules</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.10] border border-white/[0.08] text-[#a1a1a6] hover:text-white transition-all cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 11 Routes Grid List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5 pb-8">
                {allRoutes.map((route) => {
                  const isActive = pathname === route.path || (route.path !== '/' && pathname.startsWith(route.path));
                  const Icon = route.icon;

                  return (
                    <Link
                      key={route.path}
                      href={route.path}
                      onClick={() => setIsMenuOpen(false)}
                      className={clsx(
                        'flex items-center justify-between p-3 rounded-2xl transition-all duration-150 touch-press',
                        isActive
                          ? 'bg-white text-black font-semibold shadow-md'
                          : 'bg-[#121217]/60 hover:bg-[#18181F] text-[#f5f5f7] border border-white/[0.06]'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'p-2 rounded-xl shrink-0',
                          isActive ? 'bg-black/10 text-black' : 'bg-white/[0.06] text-[#0071e3]'
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-medium tracking-tight leading-tight">{route.label}</span>
                          <span className={clsx(
                            'text-[10px] leading-tight mt-0.5',
                            isActive ? 'text-black/70' : 'text-[#86868b]'
                          )}>
                            {route.desc}
                          </span>
                        </div>
                      </div>

                      <span className={clsx(
                        'text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0',
                        isActive ? 'bg-black/10 text-black' : 'bg-white/[0.04] text-[#86868b] border border-white/5'
                      )}>
                        {route.category}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
