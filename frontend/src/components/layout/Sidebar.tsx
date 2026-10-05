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
  Loader2,
  FolderSync
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
      toast.success(res.message || 'Sample test batch generated for inspection');
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed demo sandbox');
    } finally {
      setSeeding(false);
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Documents', path: '/documents', icon: FileText },
    { label: 'Review Studio', path: '/review', icon: Eye },
    { label: 'Neural Search', path: '/search', icon: Search },
    { label: 'Benchmarks', path: '/benchmarks', icon: Award, badge: '99.8%' },
    { label: 'Web Discovery', path: '/crawl', icon: Globe },
    { label: 'Spend Analytics', path: '/analytics', icon: BarChart3 },
    ...(user?.role === 'ADMIN' ? [{ label: 'Admin Console', path: '/admin', icon: ShieldCheck }] : []),
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={clsx(
        'relative z-20 hidden md:flex flex-col justify-between border-r border-white/[0.08] bg-[#0a0a0c]/90 backdrop-blur-3xl transition-all duration-300 ease-in-out select-none shrink-0 h-screen',
        sidebarOpen ? 'w-60' : 'w-20'
      )}
    >
      <div className="flex flex-col gap-4 pt-4 px-3 overflow-y-auto scrollbar">
        {/* Apple Brand Header */}
        <div className="flex items-center justify-between h-10 px-2">
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <BrandLogo size="sm" showWordmark={sidebarOpen} />
          </Link>
          
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-zinc-400 hover:text-white cursor-pointer transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Navigation Items (Apple macOS Style) */}
        <nav className="flex flex-col gap-0.5 mt-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={clsx(
                  'group flex items-center justify-between py-2 px-3 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer relative',
                  isActive
                    ? 'bg-white/[0.1] text-white shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={clsx('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200')} />
                  
                  {sidebarOpen && (
                    <span className="truncate">
                      {item.label}
                    </span>
                  )}
                </div>

                {sidebarOpen && item.badge && (
                  <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-white/10 text-zinc-300 border border-white/10">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Expand Button (Minimized Mode) */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-6 p-1 rounded-full border border-white/15 bg-[#121217] text-zinc-400 hover:text-white cursor-pointer transition-all z-30 shadow-md"
          title="Expand sidebar"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* User Footer Profile & Sign Out */}
      <div className="flex flex-col border-t border-white/[0.08] p-3 gap-2 bg-black/40">
        {user && (
          <div className="flex items-center gap-2.5 overflow-hidden px-1.5 py-1">
            <div className="h-7 w-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-semibold text-white shrink-0">
              {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-zinc-200 truncate">
                  {user.full_name || 'User'}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {user.role || 'OPERATOR'}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={logout}
          className={clsx(
            "flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs font-normal text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer",
            !sidebarOpen && "justify-center px-0"
          )}
          title="Sign out of workspace"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
