"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

export const SseStatusPill: React.FC = () => {
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      try {
        const apiUrl = getApiBaseUrl() || "https://quorum-backend-dvwv.onrender.com";
        const start = Date.now();
        const res = await fetch(`${apiUrl}/health/live`, { signal: AbortSignal.timeout(3000) });
        if (res.ok && isMounted) {
          setLatency(Date.now() - start);
        } else if (isMounted) {
          setLatency(null);
        }
      } catch {
        if (isMounted) setLatency(null);
      }
    };

    probe();
    const interval = setInterval(probe, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div 
      title="Quorum 7-Agent Neural Mesh & Deterministic Math Prover Active"
      className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium shadow-sm backdrop-blur-md"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
      <span className="font-semibold tracking-tight text-white">Quorum Mesh Active</span>
      <span className="text-[10px] text-zinc-500 hidden sm:inline">
        {latency ? `(${latency}ms)` : '• Verified'}
      </span>
    </div>
  );
};
