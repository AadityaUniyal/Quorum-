'use client';

import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { iosAudio } from '@/lib/iosAudio';

interface IOSSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const IOSSwitch: React.FC<IOSSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  className,
  size = 'md',
}) => {
  const handleToggle = () => {
    if (disabled) return;
    const next = !checked;
    iosAudio.playSwitch(next);
    onChange(next);
  };

  const isSmall = size === 'sm';
  const trackWidth = isSmall ? 'w-10' : 'w-12';
  const trackHeight = isSmall ? 'h-6' : 'h-7';
  const thumbSize = isSmall ? 'w-5 h-5' : 'w-6 h-6';
  const translateX = isSmall ? 16 : 20;

  return (
    <div
      onClick={handleToggle}
      className={clsx(
        'flex items-center justify-between gap-3 select-none',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        className
      )}
    >
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-xs font-medium text-white tracking-tight">{label}</span>}
          {description && <span className="text-[11px] text-zinc-400 mt-0.5">{description}</span>}
        </div>
      )}

      <div
        role="switch"
        aria-checked={checked}
        className={clsx(
          'relative inline-flex items-center rounded-full p-0.5 transition-colors duration-250 ease-in-out shrink-0 border shadow-inner',
          trackWidth,
          trackHeight,
          checked
            ? 'bg-[#30D158] border-[#34c759]/60 shadow-[0_0_12px_rgba(48,209,88,0.3)]'
            : 'bg-[#39393d] border-white/10'
        )}
      >
        <motion.div
          animate={{ x: checked ? translateX : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={clsx(
            'rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4),0_0_1px_rgba(0,0,0,0.2)] border border-black/5',
            thumbSize
          )}
        />
      </div>
    </div>
  );
};
