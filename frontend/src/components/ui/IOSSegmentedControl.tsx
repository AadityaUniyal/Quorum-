'use client';

import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { iosAudio } from '@/lib/iosAudio';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ElementType;
  badge?: string | number;
}

interface IOSSegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function IOSSegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: IOSSegmentedControlProps<T>) {
  const handleSelect = (val: T) => {
    if (val !== value) {
      iosAudio.playSwitch(true);
      onChange(val);
    }
  };

  const sizeClasses = {
    sm: 'p-0.5 text-[11px] h-7',
    md: 'p-1 text-xs h-9',
    lg: 'p-1.5 text-sm h-11',
  };

  const itemPadding = {
    sm: 'px-2.5 py-0.5',
    md: 'px-3.5 py-1',
    lg: 'px-4 py-1.5',
  };

  return (
    <div
      role="tablist"
      className={clsx(
        'relative inline-flex items-center rounded-2xl bg-black/40 border border-white/[0.08] backdrop-blur-2xl shadow-inner select-none',
        sizeClasses[size],
        className
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => handleSelect(option.value)}
            className={clsx(
              'relative z-10 flex items-center justify-center gap-1.5 font-medium rounded-xl transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
              itemPadding[size],
              isSelected
                ? 'text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {Icon && <Icon className={clsx(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />}
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={clsx(
                  'ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono',
                  isSelected
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-400/30'
                    : 'bg-white/10 text-zinc-400'
                )}
              >
                {option.badge}
              </span>
            )}

            {isSelected && (
              <motion.div
                layoutId="ios-segmented-active"
                className="absolute inset-0 bg-white/[0.14] rounded-xl border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] -z-10"
                transition={{
                  type: 'spring',
                  stiffness: 450,
                  damping: 32,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
