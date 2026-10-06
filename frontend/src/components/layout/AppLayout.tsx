'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { CommandPalette } from './CommandPalette';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { IOSControlCenter } from '@/components/ui/IOSControlCenter';

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
  const { accentColor, fontFamily } = useUIStore();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadUser();

    // Apply saved accent & font
    const savedAccent = localStorage.getItem('quorum_accent') || accentColor || 'blue';
    const savedFont = localStorage.getItem('quorum_font') || fontFamily || 'sf-pro';
    document.documentElement.setAttribute('data-accent', savedAccent);
    document.documentElement.setAttribute('data-font', savedFont);
  }, [loadUser, accentColor, fontFamily]);

  if (!mounted) {
    return null;
  }

  const isPublicPage = pathname === '/' || pathname === '/pricing';

  if (isPublicPage) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-black text-foreground font-sans">
          <main id="main-content" role="main" aria-label="Main content">
            {children}
          </main>
        </div>
        <CommandPalette />
        <KeyboardShortcutsModal />
        <IOSControlCenter />
        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0A0A0C',
              color: '#f5f5f7',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(32px)',
              fontSize: '12px',
              borderRadius: '20px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
            },
            success: {
              iconTheme: {
                primary: '#30d158',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ff453a',
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
      <div className="flex h-screen bg-black overflow-hidden">
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
      
      {/* Global Command Palette, Control Center & Keyboard Shortcuts */}
      <CommandPalette />
      <KeyboardShortcutsModal />
      <IOSControlCenter />

      {/* iOS Style Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0d0d11',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            backdropFilter: 'blur(32px)',
            fontSize: '12px',
            borderRadius: '20px',
            boxShadow: '0 20px 48px rgba(0,0,0,0.85)',
          },
          success: {
            iconTheme: {
              primary: '#30d158',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ff453a',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  );
};
