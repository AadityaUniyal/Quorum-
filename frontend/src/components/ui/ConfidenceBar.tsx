import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';

interface ConfidenceBarProps {
  score: number; // 0.0 to 1.0
  className?: string;
  showText?: boolean;
  label?: string;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  score,
  className,
  showText = true,
  label,
}) => {
  const percent = Math.min(Math.max(Math.round(score * 100), 0), 100);
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(percent);
    }, 120);
    return () => clearTimeout(timer);
  }, [percent]);

  // Obsidian Titanium accent colors
  let barGradient = 'from-rose-500 to-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.35)]';
  let textColor = 'text-rose-400';

  if (percent >= 85) {
    barGradient = 'from-emerald-400 to-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]';
    textColor = 'text-emerald-400';
  } else if (percent >= 70) {
    barGradient = 'from-amber-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.35)]';
    textColor = 'text-amber-400';
  }

  return (
    <div
      role="progressbar"
      aria-label={label || `Confidence score: ${percent}%`}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${percent}% confidence`}
      className={clsx('flex items-center gap-3 w-full select-none', className)}
    >
      <div className="relative h-2 w-full rounded-full bg-white/[0.05] border border-white/[0.06] overflow-hidden backdrop-blur-md">
        <div
          className={clsx(
            'h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out',
            barGradient
          )}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
      {showText && (
        <span
          aria-hidden="true"
          className={clsx('text-xs font-mono font-semibold min-w-[36px] text-right', textColor)}
        >
          {percent}%
        </span>
      )}
    </div>
  );
};
