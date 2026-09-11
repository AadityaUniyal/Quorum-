"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, BarChart2, Shield, Settings, Bot, RefreshCw } from "lucide-react";

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isOpen) return null;

  const commands = [
    { name: "Go to Dashboard", icon: BarChart2, href: "/dashboard" },
    { name: "Document Library", icon: FileText, href: "/documents" },
    { name: "Document Review Queue", icon: Bot, href: "/review" },
    { name: "Semantic Search & RAG", icon: Search, href: "/search" },
    { name: "Analytics & KPIs", icon: BarChart2, href: "/analytics" },
    { name: "Web Crawler Engine", icon: RefreshCw, href: "/crawl" },
    { name: "Admin Dashboard", icon: Shield, href: "/admin" },
    { name: "Account Settings", icon: Settings, href: "/settings" },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-3 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search page... (Esc to close)"
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          <kbd className="px-2 py-0.5 text-[10px] uppercase font-mono bg-slate-800 border border-slate-700 text-slate-400 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No matching commands found.</div>
          ) : (
            filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.href}
                  onClick={() => handleSelect(cmd.href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition text-left"
                >
                  <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{cmd.name}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
