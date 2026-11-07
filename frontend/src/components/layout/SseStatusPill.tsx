"use client";

import React, { useEffect, useState } from "react";
import { Cpu, Cloud } from "lucide-react";

export const SseStatusPill: React.FC = () => {
  const [mode, setMode] = useState<"cloud_live" | "standalone_engine">("standalone_engine");

  useEffect(() => {
    let isMounted = true;
    const probeBackend = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://docintel-api.onrender.com";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${apiUrl}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok && isMounted) {
          setMode("cloud_live");
        } else if (isMounted) {
          setMode("standalone_engine");
        }
      } catch {
        if (isMounted) setMode("standalone_engine");
      }
    };

    probeBackend();
    const interval = setInterval(probeBackend, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (mode === "cloud_live") {
    return (
      <div 
        title="Connected to high-availability multi-tenant cloud worker cluster"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-mono font-medium backdrop-blur-md"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <Cloud className="w-3 h-3 text-emerald-400" />
        <span>Cloud Core Active</span>
      </div>
    );
  }

  return (
    <div 
      title="Running Standalone Client Verification Core: SMT arithmetic constraint solver & Merkle tree engine active locally"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[11px] font-mono font-medium backdrop-blur-md"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
      <Cpu className="w-3 h-3 text-cyan-400" />
      <span>Standalone SMT Core</span>
    </div>
  );
};
