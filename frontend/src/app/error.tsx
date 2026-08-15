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

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center max-w-md text-center space-y-6">
        <div className="bg-red-500/10 p-4 rounded-full">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-gray-400">
            An unexpected error occurred. Our team has been notified.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
          
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors text-sm font-medium"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
