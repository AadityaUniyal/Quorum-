'use client';

import React from 'react';
import CountUp from 'react-countup';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  accentColor?: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
  className?: string;
  isLoading?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  icon: Icon,
  label,
  value,
  decimals = 0,
  suffix = '',
  prefix = '',
  trend,
  accentColor = 'primary',
  className,
  isLoading = false,
}) => {
  const accentColors = {
    primary: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    danger: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    accent: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl p-6 bg-[#121217]/80 border border-white/5 backdrop-blur-2xl min-h-[140px] animate-pulse flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="h-4 w-28 bg-white/5 rounded-md" />
          <div className="h-8 w-8 bg-white/5 rounded-xl" />
        </div>
        <div className="h-8 w-32 bg-white/5 rounded-md mt-4" />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'group relative overflow-hidden rounded-2xl p-6 bg-[#121217]/80 border border-white/[0.08] hover:border-white/20 hover:bg-[#16161d] transition-all duration-300 shadow-lg backdrop-blur-2xl flex flex-col justify-between select-none min-h-[140px]',
        className
      )}
    >
      <div className="flex justify-between items-start gap-4">
        <span className="text-[12px] font-medium text-zinc-400 tracking-wide font-sans">
          {label}
        </span>
        <div
          className={clsx(
            'p-2 rounded-xl border transition-colors',
            accentColors[accentColor]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-3xl font-semibold tracking-tight text-white font-mono flex items-baseline">
            {prefix && <span className="text-xl font-normal mr-1 text-zinc-400">{prefix}</span>}
            <CountUp end={value} decimals={decimals} duration={1.2} separator="," />
            {suffix && <span className="text-xl font-normal ml-0.5 text-zinc-400">{suffix}</span>}
          </h3>
        </div>

        {trend && (
          <div
            className={clsx(
              'flex items-center gap-1 text-[11px] font-medium font-mono px-2 py-0.5 rounded-full border',
              trend.isPositive
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            )}
          >
            {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
    </div>
  );
};
