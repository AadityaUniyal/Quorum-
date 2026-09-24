'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { clsx } from 'clsx';

export type TimeRangeOption = 7 | 30 | 90 | 365 | 0;

interface DateRangePickerProps {
  selectedRange: TimeRangeOption;
  onChange: (range: TimeRangeOption) => void;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  selectedRange,
  onChange,
  className,
}) => {
  const options: { label: string; value: TimeRangeOption }[] = [
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
    { label: '1 Year', value: 365 },
    { label: 'All Time', value: 0 },
  ];

  return (
    <div className={clsx('flex items-center gap-1.5 bg-white/5 border border-white/10 p-1 rounded-xl shadow-inner select-none', className)}>
      <div className="flex items-center gap-1 px-2.5 text-xs text-muted-foreground font-medium">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        <span className="hidden sm:inline">Range:</span>
      </div>
      <div className="flex items-center gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer',
              selectedRange === opt.value
                ? 'bg-primary text-primary-foreground shadow-md font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DateRangePicker;
