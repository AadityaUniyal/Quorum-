'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { 
  LayoutDashboard, 
  FileText, 
  Eye, 
  Search, 
  BarChart3, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Globe,
  Settings,
  Award,
  ShieldCheck,
  Sparkles,
  Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [seeding, setSeeding] = useState(false);

  const handleSeedSandbox = async () => {
    setSeeding(true);
    try {
      const res = await api.seedDemoSandbox();
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['charts'] });
      toast.success(res.message || 'Demo Sandbox successfully seeded with test documents!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed demo sandbox');
    } finally {
      setSeeding(false);
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Documents', path: '/documents', icon: FileText },
    { label: 'Review Queue', path: '/review', icon: Eye },
    { label: 'Neural Search', path: '/search', icon: Search },
    { label: 'Benchmarks', path: '/benchmarks', icon: Award, badge: 'Accuracy' },
    { label: 'Web Discovery', path: '/crawl', icon: Globe },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    ...(user?.role === 'ADMIN' ? [{ label: 'Admin Console', path: '/admin', icon: ShieldCheck }] : []),
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={clsx(
        'relative z-20 hidden md:flex flex-col justify-between border-r border-white/[0.06] bg-[#090d16]/95 backdrop-blur-xl transition-all duration-300 ease-in-out select-none shrink-0 h-screen shadow-2xl',
        sidebarOpen ? 'w-64' : 'w-20'
      )}
    >
      <div className="flex flex-col gap-5 pt-5 px-3 overflow-y-auto scrollbar">
        {/* Brand / Logo */}
        <div className="flex items-center justify-between h-10 px-2">
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <BrandLogo size="sm" showWordmark={sidebarOpen} />
          </Link>
          
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 mt-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={clsx(
                  'group flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer relative touch-press',
                  isActive
                    ? 'bg-primary/10 text-primary border-primary/25 shadow-sm shadow-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.03] hover:border-white/[0.06]'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={clsx('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-neutral-400 group-hover:text-neutral-200')} />
                  
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="font-sans truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </div>

                {sidebarOpen && item.badge && (
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}

                {isActive && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute left-0 w-1 h-5 rounded-r-full bg-primary"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Demo Sandbox Card (When expanded) */}
        {sidebarOpen && (
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-indigo-950/30 border border-primary/20 flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-1.5 text-primary text-xs font-bold font-sans">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Demo Sandbox</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-normal">
              1-click generate verified invoices &amp; purchase orders to test cognitive validation.
            </p>
            <button
              onClick={handleSeedSandbox}
              disabled={seeding}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {seeding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              <span>{seeding ? 'Seeding Data...' : 'Seed Test Data'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Expand Button (Minimized Mode) */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-7 p-1 rounded-full border border-white/[0.1] bg-[#0c121e] text-muted-foreground hover:text-foreground cursor-pointer transition-all z-30 shadow-md"
          title="Expand sidebar"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* User Footer Profile & Sign Out */}
      <div className="flex flex-col border-t border-white/[0.06] p-3 gap-3 bg-black/20">
        {user && (
          <div className="flex items-center gap-2.5 overflow-hidden px-1">
            <div className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary font-mono shrink-0">
              {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-neutral-200 truncate">
                  {user.full_name}
                </span>
                <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider">
                  {user.role}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={logout}
          className={clsx(
            "flex items-center gap-2.5 py-2 px-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer",
            !sidebarOpen && "justify-center px-0"
          )}
          title="Sign out of console"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
