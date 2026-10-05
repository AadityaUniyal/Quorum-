'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const handleResetAndReload = () => {
    try {
      if (typeof window !== 'undefined') {
        // Clear any potentially corrupted temporary cache
        sessionStorage.clear();
      }
      reset();
    } catch {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-[#06090F] text-white flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center max-w-lg text-center space-y-6">
        <div className="bg-red-500/10 p-5 rounded-2xl border border-red-500/20 shadow-xl shadow-red-500/5">
          <AlertTriangle className="w-12 h-12 text-red-400" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Something went wrong</h1>
          <p className="text-sm text-neutral-400 max-w-sm mx-auto">
            {error?.message || 'An unexpected client runtime error occurred. Our self-healing layer has caught the event.'}
          </p>
        </div>

        {error?.digest && (
          <div className="text-[11px] font-mono text-neutral-500 bg-white/[0.03] px-3 py-1 rounded-md border border-white/5">
            Event Digest: {error.digest}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleResetAndReload}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl transition-all text-sm font-semibold shadow-lg shadow-blue-600/20 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            Restore Session
          </button>
          
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-neutral-200 hover:text-white rounded-xl transition-all text-sm font-semibold border border-white/10"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
