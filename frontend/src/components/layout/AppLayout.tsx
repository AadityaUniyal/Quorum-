'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth';
import { AuthPage } from '@/components/auth/AuthPage';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useUIStore } from '@/stores/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: 'always',
      retry: 1,
      refetchIntervalInBackground: true,
    },
  },
});

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user, loadUser, isLoading } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [authChecked, setAuthChecked] = useState(false);

  // Restore user theme selection
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  useEffect(() => {
    const applyFontScale = () => {
      const storedFont = localStorage.getItem('settings_font_size') || 'md';
      const scale = storedFont === 'sm' ? '15px' : storedFont === 'lg' ? '17px' : '16px';
      document.documentElement.style.fontSize = scale;
      document.documentElement.setAttribute('data-font-size', storedFont);
    };
    applyFontScale();
    window.addEventListener('storage', applyFontScale);
    return () => window.removeEventListener('storage', applyFontScale);
  }, []);

  useEffect(() => {
    const savedSidebar = localStorage.getItem('settings_sidebar_collapsed');
    if (savedSidebar !== null) {
      setSidebarOpen(savedSidebar !== 'true');
    }
  }, [setSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('settings_sidebar_collapsed', String(!sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await loadUser();
      } catch {
        // Handled in loadUser
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, [loadUser]);

  if (!authChecked || isLoading) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center h-screen w-screen bg-[radial-gradient(circle_at_top,rgba(79,110,247,0.12),transparent_35%),linear-gradient(180deg,#05070d_0%,#070b13_100%)]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="text-sm font-semibold tracking-wider text-muted-foreground font-mono">
          Authenticating session...
        </span>
      </div>
    );
  }

  // Auth Gate
  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthPage />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#111111',
              color: '#F5F5F5',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              fontFamily: 'var(--font-sans), sans-serif',
            },
          }}
        />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-screen overflow-hidden text-[#F5F5F5] bg-[linear-gradient(180deg,#05070d_0%,#070b13_100%)]">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(110,168,255,0.08),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.08),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(34,197,94,0.05),transparent_22%)]" />
        <Sidebar />
        
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-transparent relative">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full h-full relative z-10"
            >
              {children}
            </motion.div>
          </main>
        </div>

        <CommandPalette />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#111111',
              color: '#F5F5F5',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              fontFamily: 'var(--font-sans), sans-serif',
              fontSize: '13px',
              fontWeight: 500,
            },
          }}
        />
      </div>
    </QueryClientProvider>
  );
};
export default AppLayout;
