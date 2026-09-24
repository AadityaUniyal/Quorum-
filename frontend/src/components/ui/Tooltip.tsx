import React, { useState } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { clsx } from 'clsx';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  className,
}) => {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            className={clsx(
              'z-50 overflow-hidden rounded-lg border border-white/10 bg-[#0c0c0c]/95 backdrop-blur-md px-3 py-1.5 text-xs text-white shadow-xl animate-in fade-in-0 zoom-in-95',
              className
            )}
            sideOffset={5}
          >
            {content}
            <RadixTooltip.Arrow className="fill-[#0c0c0c]/95" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};

// Simple tooltip without Radix (for icon-only buttons)
export const SimpleTooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-flex" role="tooltip">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          className={clsx(
            'absolute z-50 px-3 py-1.5 text-xs font-medium text-white bg-[#0c0c0c]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl whitespace-nowrap pointer-events-none',
            {
              'bottom-full left-1/2 -translate-x-1/2 mb-2': side === 'top',
              'top-full left-1/2 -translate-x-1/2 mt-2': side === 'bottom',
              'right-full top-1/2 -translate-y-1/2 mr-2': side === 'left',
              'left-full top-1/2 -translate-y-1/2 ml-2': side === 'right',
            },
            className
          )}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};
