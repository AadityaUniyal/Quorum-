'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Target, Zap, Activity } from 'lucide-react';
import clsx from 'clsx';

interface RingData {
  name: string;
  value: number; // 0 to 100
  color: string;
  bgColor: string;
  icon: React.ElementType;
  unit?: string;
}

interface IOSActivityRingsProps {
  accuracy?: number;
  consensus?: number;
  slaSpeed?: number;
  size?: number;
  className?: string;
  showLegend?: boolean;
}

export const IOSActivityRings: React.FC<IOSActivityRingsProps> = ({
  accuracy = 99.8,
  consensus = 98.4,
  slaSpeed = 95.0,
  size = 180,
  className,
  showLegend = true,
}) => {
  const rings: RingData[] = [
    {
      name: 'Extraction Accuracy',
      value: Math.min(100, Math.max(0, accuracy)),
      color: '#0071e3', // Cupertino Blue
      bgColor: 'rgba(0, 113, 227, 0.2)',
      icon: Target,
      unit: '%',
    },
    {
      name: 'Agent Consensus',
      value: Math.min(100, Math.max(0, consensus)),
      color: '#30D158', // Apple Emerald
      bgColor: 'rgba(48, 209, 88, 0.2)',
      icon: ShieldCheck,
      unit: '%',
    },
    {
      name: 'Throughput SLA',
      value: Math.min(100, Math.max(0, slaSpeed)),
      color: '#AF52DE', // Vision Purple
      bgColor: 'rgba(175, 82, 222, 0.2)',
      icon: Zap,
      unit: '%',
    },
  ];

  const strokeWidth = 12;
  const gap = 4;
  const center = size / 2;

  return (
    <div className={clsx('flex flex-col sm:flex-row items-center gap-6 select-none', className)}>
      {/* Concentric Rings SVG */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {rings.map((ring, idx) => {
            const radius = center - strokeWidth / 2 - idx * (strokeWidth + gap);
            const circumference = 2 * Math.PI * radius;
            const progressOffset = circumference - (ring.value / 100) * circumference;

            return (
              <g key={ring.name}>
                {/* Background Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={ring.bgColor}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeLinecap="round"
                />
                {/* Active Progress Ring */}
                <motion.circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={ring.color}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: progressOffset }}
                  transition={{
                    duration: 1.4,
                    ease: [0.32, 0.72, 0, 1],
                    delay: idx * 0.15,
                  }}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Center Activity Icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="p-2 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/10 text-white">
            <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Legend & Breakdown */}
      {showLegend && (
        <div className="flex flex-col gap-3 flex-1 min-w-[200px] w-full">
          <div className="text-xs font-semibold text-white tracking-tight flex items-center justify-between pb-1 border-b border-white/10">
            <span>Operational Activity</span>
            <span className="text-[10px] font-mono text-emerald-400">All Metrics Verified</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {rings.map((ring) => {
              const Icon = ring.icon;
              return (
                <div
                  key={ring.name}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: ring.color, boxShadow: `0 0 8px ${ring.color}` }}
                    />
                    <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <Icon className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{ring.name}</span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-white">
                    {ring.value.toFixed(1)}
                    <span className="text-[10px] text-zinc-500 font-sans font-normal ml-0.5">
                      {ring.unit}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
