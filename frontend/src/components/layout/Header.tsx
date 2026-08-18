'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import {
  Search, 
  Bell, 
  Sun, 
  Moon, 
  ChevronRight, 
  LogOut, 
  Settings,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
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

  // Convert pathname to breadcrumbs
  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return [{ label: 'Console', href: '/dashboard', active: true }];
    return parts.map((part, index) => {
      const href = '/' + parts.slice(0, index + 1).join('/');
      const label = part.charAt(0).toUpperCase() + part.slice(1);
      return {
        label: label === 'Crawl' ? 'Web Crawler' : label === 'Review' ? 'Review Queue' : label,
        href,
        active: index === parts.length - 1
      };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  // Notifications are currently derived from the app state and API payloads.
  const notifications = [
    { id: '1', title: 'Review Required', desc: 'Invoice #INV-2901 details validation discrepancy flagged.', type: 'error', time: '5m ago' },
    { id: '2', title: 'Lock Released', desc: 'Agreement lock expired for Contract_Acme.pdf.', type: 'info', time: '1h ago' }
  ];

  return (
    <header className="h-16 border-b border-white/[0.04] bg-[#080808]/90 backdrop-blur-md px-6 flex items-center justify-between select-none relative z-30 w-full shrink-0">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="hover:text-foreground cursor-pointer transition-colors" onClick={() => router.push('/dashboard')}>
          DocIntel AI
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
        {/* Search Command Palette Trigger */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 bg-[#111] hover:bg-[#161b22] border border-white/[0.04] hover:border-white/[0.08] text-muted-foreground hover:text-foreground transition-all duration-200 px-3.5 py-1.5 rounded-xl cursor-pointer shadow-inner shrink-0"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground/80" />
          <span className="text-[10px] font-mono leading-none tracking-wider uppercase">Search / Cmd+K</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-white/[0.04] bg-[#111]/80 hover:bg-[#161b22] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
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
                : "border-white/[0.04] bg-[#111]/80 hover:bg-[#161b22] text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
            </span>
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
                  className="absolute right-0 mt-2.5 w-72 glass-card bg-[#0b0b0b] border border-white/[0.08] shadow-2xl rounded-2xl overflow-hidden z-50 p-1 flex flex-col gap-0.5"
                >
                  <div className="p-3 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between text-xs select-none">
                    <span className="font-bold text-foreground font-sans">Active Notifications</span>
                    <span className="text-[10px] font-mono text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10">
                      2 Unread
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-1 max-h-60 overflow-y-auto scrollbar">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="flex gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.02] border border-transparent transition-colors duration-150 text-[11px]"
                      >
                        <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between w-full font-semibold text-neutral-200">
                            <span>{notif.title}</span>
                            <span className="text-[9px] font-mono text-muted-foreground font-normal">{notif.time}</span>
                          </div>
                          <p className="text-muted-foreground leading-normal font-sans text-[10px]">{notif.desc}</p>
                        </div>
                      </div>
                    ))}
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
            className="h-8 w-8 rounded-xl bg-neutral-900 border border-white/[0.06] hover:border-white/[0.12] flex items-center justify-center text-xs font-bold text-primary font-mono cursor-pointer transition-all duration-200 select-none shrink-0"
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
                  className="absolute right-0 mt-2.5 w-52 glass-card bg-[#0b0b0b] border border-white/[0.08] shadow-2xl rounded-2xl overflow-hidden z-50 p-1 flex flex-col gap-0.5"
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
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Developer API Keys</span>
                  </button>

                  <div className="h-px bg-white/[0.04] my-0.5 mx-1" />

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] text-rose-450 hover:text-rose-400 hover:bg-rose-500/5 border border-transparent cursor-pointer transition-colors text-left"
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
