import { Search, Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center max-w-md text-center space-y-6">
        <div className="bg-white/5 p-4 rounded-full">
          <Search className="w-12 h-12 text-gray-400" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">404 - Page Not Found</h1>
          <p className="text-gray-400">
            We couldn't find the page you were looking for. It might have been moved or deleted.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors text-sm font-medium"
        >
          <Home className="w-4 h-4" />
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
