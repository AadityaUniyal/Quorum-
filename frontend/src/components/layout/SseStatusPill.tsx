"use client";

import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

export const SseStatusPill: React.FC = () => {
  const [status, setStatus] = useState<"connected" | "reconnecting" | "offline">("connected");

  useEffect(() => {
    const handleOnline = () => setStatus("connected");
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (status === "connected") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <Wifi className="w-3 h-3" />
        <span>Live SSE Stream</span>
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span>Reconnecting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
      <WifiOff className="w-3 h-3" />
      <span>Offline</span>
    </div>
  );
};
