'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';

export interface SliderProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (val: number) => void;
  disabled?: boolean;
  label?: string;
  unit?: string;
  showValue?: boolean;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value: controlledValue,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  label,
  unit = '',
  showValue = true,
  className,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  const percentage = Math.min(Math.max(((currentValue - min) / (max - min)) * 100, 0), 100);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = parseFloat(e.target.value);
    if (!isControlled) {
      setInternalValue(nextVal);
    }
    onChange?.(nextVal);
  };

  return (
    <div className={clsx('flex flex-col gap-2 w-full select-none font-sans', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs font-medium">
          {label && <span className="text-[#a1a1a6]">{label}</span>}
          {showValue && (
            <span className="font-mono text-[#f5f5f7] bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06] text-[11px]">
              {currentValue}
              {unit}
            </span>
          )}
        </div>
      )}

      <div className="relative flex items-center h-6 w-full cursor-pointer touch-none">
        {/* Track background */}
        <div className="relative h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden border border-white/[0.04]">
          {/* Active fill */}
          <div
            className="h-full bg-gradient-to-r from-[#0071e3] to-[#38bdf8] rounded-full transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Tactile Native Range Input overlaid */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          disabled={disabled}
          onChange={handleInputChange}
          aria-label={label || 'Slider'}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
          className={clsx(
            'absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed',
            disabled && 'pointer-events-none'
          )}
        />

        {/* Visual Apple Thumb */}
        <div
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none',
            'w-4.5 h-4.5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] border border-white/80',
            'transition-transform duration-150',
            'group-hover:scale-110 active:scale-125',
            disabled && 'opacity-40'
          )}
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
