'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { api } from '@/lib/api';
import { SseStatusPill } from '@/components/layout/SseStatusPill';
import {
  Search, 
  Bell, 
  Sun, 
  Moon, 
  ChevronRight, 
  LogOut, 
  Settings,
  Key,
  CheckCircle2,
  Inbox,
  Command,
  Sparkles
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, isDemoMode } = useAuthStore();
  const { setCommandPaletteOpen } = useUIStore();

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Load and apply theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme as 'dark' | 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Fetch real notifications from backend
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (isDemoMode) return [];
      try {
        return await api.getNotifications();
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter((n: { is_read: boolean }) => !n.is_read).length;

  // Convert pathname to clean breadcrumbs
  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return [{ label: 'Dashboard', href: '/dashboard', active: true }];
    return parts.map((part, index) => {
      const href = '/' + parts.slice(0, index + 1).join('/');
      const label = part.charAt(0).toUpperCase() + part.slice(1);
      return {
        label: label === 'Crawl' ? 'Web Discovery' : label === 'Review' ? 'Review Studio' : label,
        href,
        active: index === parts.length - 1
      };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return 'just now';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.08] bg-black/75 px-6 backdrop-blur-2xl transition-all">
      {/* Left: macOS Style Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-normal">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.href}>
            {idx > 0 && <ChevronRight className="h-3 w-3 text-zinc-600" />}
            <span
              className={clsx(
                crumb.active ? 'text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 transition-colors'
              )}
            >
              {crumb.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Center: macOS Spotlight Style Search Trigger */}
      <div className="hidden sm:flex items-center">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-zinc-400 hover:text-white transition-all cursor-pointer shadow-sm w-64 justify-between"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-[12px] font-normal">Search documents...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-zinc-400">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Status Pill, Notifications & User Menu */}
      <div className="flex items-center gap-3">
        <SseStatusPill />

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-black" />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#121217] border border-white/10 shadow-2xl p-4 z-50 text-white"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
                    <span className="font-semibold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-mono">
                        {unreadCount} new
                      </span>
                    )}
                  </div>

                  <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                        <Inbox className="w-6 h-6 opacity-30" />
                        <span>No new notifications</span>
                      </div>
                    ) : (
                      notifications.map((n: any) => (
                        <div
                          key={n.id}
                          onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
                          className={clsx(
                            "p-2.5 rounded-xl border transition-all cursor-pointer text-xs",
                            n.is_read
                              ? "bg-white/[0.02] border-white/5 text-zinc-400"
                              : "bg-blue-500/5 border-blue-500/20 text-zinc-200"
                          )}
                        >
                          <div className="font-medium text-white">{n.title}</div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">{n.message}</div>
                          <div className="text-[9px] text-zinc-500 mt-1 font-mono">{formatTime(n.created_at)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Avatar / Quick Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-white/20 transition-all cursor-pointer"
          >
            <div className="h-7 w-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-semibold text-white">
              {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
            </div>
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#121217] border border-white/10 shadow-2xl p-2 z-50 text-white"
                >
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <div className="text-xs font-semibold text-white truncate">{user?.full_name || 'User'}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{user?.email || 'operator@quorum.os'}</div>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-left"
                  >
                    <Settings className="w-3.5 h-3.5 text-zinc-400" />
                    <span>System Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
