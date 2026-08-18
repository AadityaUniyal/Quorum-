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
  const [authChecked, setAuthChecked] = useState(false);

  // Restore user theme selection
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

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
      <div className="flex flex-col gap-4 items-center justify-center h-screen w-screen bg-[#080808]">
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
      <div className="flex h-screen w-screen bg-[#080808] overflow-hidden text-[#F5F5F5]">
        <Sidebar />
        
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#080808]">
          <Header />
          <main className="flex-1 overflow-y-auto p-8 relative">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full h-full"
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
