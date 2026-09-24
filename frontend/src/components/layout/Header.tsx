'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { api } from '@/lib/api';
import { SseStatusPill } from '@/components/layout/SseStatusPill';
import { BrandLogo } from '@/components/ui/BrandLogo';
import {
  Search, 
  Bell, 
  Sun, 
  Moon, 
  ChevronRight, 
  LogOut, 
  Settings,
  Key,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { toast } from 'react-hot-toast';
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

  // Convert pathname to breadcrumbs
  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return [{ label: 'Console', href: '/dashboard', active: true }];
    return parts.map((part, index) => {
      const href = '/' + parts.slice(0, index + 1).join('/');
      const label = part.charAt(0).toUpperCase() + part.slice(1);
      return {
        label: label === 'Crawl' ? 'Web Discovery' : label === 'Review' ? 'Review Queue' : label,
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
      return '';
    }
  };

  return (
    <header className="h-16 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl px-6 flex items-center justify-between select-none relative z-30 w-full shrink-0">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="hover:text-foreground cursor-pointer transition-colors flex items-center gap-1.5" onClick={() => router.push('/dashboard')}>
          <BrandLogo size="sm" showWordmark={false} />
          <span className="hidden sm:inline font-semibold text-foreground">Quorum</span>
        </span>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span
              onClick={() => !crumb.active && router.push(crumb.href)}
              className={clsx(
                "transition-colors",
                crumb.active ? "text-foreground font-semibold" : "hover:text-foreground cursor-pointer"
              )}
            >
              {crumb.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        <SseStatusPill />

        {/* Search Command Palette Trigger */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/15 text-muted-foreground hover:text-foreground transition-all duration-200 px-3.5 py-1.5 rounded-xl cursor-pointer shadow-inner shrink-0 touch-press"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground/80" />
          <span className="text-[10px] font-mono leading-none tracking-wider uppercase">Search / Cmd+K</span>
        </button>

        {/* Public Benchmarks Observatory Link */}
        <button
          onClick={() => router.push('/benchmarks')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold transition-all cursor-pointer shadow-sm touch-press"
          title="Inspect independent accuracy and verification benchmarks"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Benchmarks</span>
        </button>

        {/* 1-Click Sandbox Loader */}
        <button
          onClick={async () => {
            try {
              toast.loading('Seeding enterprise benchmark scenarios...', { id: 'seed-demo' });
              const res = await api.seedDemoSandbox();
              queryClient.invalidateQueries({ queryKey: ['documents'] });
              queryClient.invalidateQueries({ queryKey: ['kpis'] });
              queryClient.invalidateQueries({ queryKey: ['charts'] });
              toast.success(res?.message || 'Demo dataset loaded!', { id: 'seed-demo' });
              router.push('/documents');
            } catch (e: any) {
              toast.error(e?.message || 'Failed to seed sandbox', { id: 'seed-demo' });
            }
          }}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          title="Seed 5 realistic enterprise documents in 1-click for instant evaluation"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Try Demo Sandbox</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications Popover Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className={clsx(
              "p-2 rounded-xl border transition-colors cursor-pointer relative",
              showNotifications 
                ? "bg-primary/10 border-primary/20 text-primary" 
                : "border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
              </span>
            )}
          </button>

          {/* Notifications Drawer */}
          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2.5 w-80 glass-card bg-black/60 border border-white/10 shadow-2xl rounded-2xl overflow-hidden z-50 p-1 flex flex-col gap-0.5"
                >
                  <div className="p-3 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between text-xs select-none">
                    <span className="font-bold text-foreground font-sans">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-mono text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10">
                        {unreadCount} Unread
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 p-1 max-h-72 overflow-y-auto scrollbar">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                        <Inbox className="h-8 w-8 opacity-40" />
                        <span className="text-[11px] font-medium">No notifications yet</span>
                      </div>
                    ) : (
                      notifications.map((notif: { id: string; title: string; message: string; is_read: boolean; created_at: string }) => (
                        <button
                          key={notif.id}
                          onClick={() => {
                            if (!notif.is_read && !isDemoMode) {
                              markReadMutation.mutate(notif.id);
                            }
                          }}
                          className={clsx(
                            "flex gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.03] border transition-colors duration-150 text-[11px] text-left cursor-pointer w-full",
                            notif.is_read ? "border-transparent opacity-60" : "border-white/[0.04] bg-white/[0.01]"
                          )}
                        >
                          {notif.is_read ? (
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between w-full font-semibold text-neutral-200">
                              <span className="truncate">{notif.title}</span>
                              <span className="text-[9px] font-mono text-muted-foreground font-normal shrink-0 ml-2">
                                {formatTime(notif.created_at)}
                              </span>
                            </div>
                            <p className="text-muted-foreground leading-normal font-sans text-[10px] line-clamp-2">{notif.message}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Avatar Popover Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="h-8 w-8 rounded-xl bg-white/6 border border-white/10 hover:border-white/20 flex items-center justify-center text-xs font-bold text-primary font-mono cursor-pointer transition-all duration-200 select-none shrink-0"
          >
            {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2.5 w-52 glass-card bg-black/60 border border-white/10 shadow-2xl rounded-2xl overflow-hidden z-50 p-1 flex flex-col gap-0.5"
                >
                  {/* User profile brief card */}
                  <div className="p-3 border-b border-white/[0.04] bg-white/[0.01] flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-white/[0.06] flex items-center justify-center text-xs font-bold text-primary font-mono">
                      {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-neutral-200 truncate">{user?.full_name}</span>
                      <span className="text-[9px] font-bold font-mono text-muted-foreground uppercase">{user?.role}</span>
                    </div>
                  </div>

                  {/* Menu navigation options */}
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] text-neutral-300 hover:text-foreground hover:bg-white/[0.02] cursor-pointer transition-colors text-left"
                  >
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Account Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      router.push('/settings?tab=apikeys');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] text-neutral-300 hover:text-foreground hover:bg-white/[0.02] cursor-pointer transition-colors text-left"
                  >
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Developer API Keys</span>
                  </button>

                  <div className="h-px bg-white/[0.04] my-0.5 mx-1" />

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 border border-transparent cursor-pointer transition-colors text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" />
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

export default Header;
