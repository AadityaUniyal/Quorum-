'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { CommandPalette } from './CommandPalette';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loadUser } = useAuthStore();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadUser();
  }, [loadUser]);

  if (!mounted) {
    return null;
  }

  const isPublicPage = pathname === '/' || pathname === '/pricing';

  if (isPublicPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-black text-foreground font-sans selection:bg-blue-500/30">
          <main id="main-content" role="main" aria-label="Main content">
            {children}
          </main>
        </div>
        <CommandPalette />
        <KeyboardShortcutsModal />
        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0A0A0C',
              color: '#f5f5f7',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(28px)',
              fontSize: '12px',
              borderRadius: '16px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-background overflow-hidden selection:bg-blue-500/30">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main 
            id="main-content" 
            className="flex-1 overflow-auto bg-black"
            role="main"
            aria-label="Main content"
          >
            {children}
          </main>
          <MobileNav />
        </div>
      </div>
      
      {/* Global Command Palette & Keyboard Shortcuts Helper */}
      <CommandPalette />
      <KeyboardShortcutsModal />

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0d0d11',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            fontSize: '12px',
            borderRadius: '16px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
};
