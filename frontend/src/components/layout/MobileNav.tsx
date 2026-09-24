'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Eye, 
  Search, 
  Settings
} from 'lucide-react';
import clsx from 'clsx';

export const MobileNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Console', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Documents', path: '/documents', icon: FileText },
    { label: 'Review', path: '/review', icon: Eye },
    { label: 'Search', path: '/search', icon: Search },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#080c14]/95 backdrop-blur-xl border-t border-white/[0.08] px-2 py-1.5 flex items-center justify-around select-none pb-safe">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.path);
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            href={item.path}
            className={clsx(
              "flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all",
              isActive 
                ? "text-primary font-bold" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={clsx("p-1 rounded-lg", isActive && "bg-primary/10")}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
