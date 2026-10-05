'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';

interface DropdownMenuContextType {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | null>(null);

export interface DropdownMenuProps {
  children: React.ReactNode;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger: React.FC<{
  children: React.ReactElement<any>;
  asChild?: boolean;
}> = ({ children }) => {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

  return (
    <div
      ref={context.triggerRef}
      onClick={() => context.setIsOpen(!context.isOpen)}
      className="inline-flex cursor-pointer"
    >
      {children}
    </div>
  );
};

export interface DropdownMenuContentProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ align = 'start', sideOffset = 4, className, children, ...props }, ref) => {
    const context = useContext(DropdownMenuContext);
    if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');
    const { isOpen } = context;

    const alignStyles = {
      start: 'left-0 origin-top-left',
      center: 'left-1/2 -translate-x-1/2 origin-top',
      end: 'right-0 origin-top-right',
    };

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            style={{ marginTop: sideOffset }}
            className={clsx(
              'absolute z-50 min-w-[180px] rounded-2xl bg-[#121217]/95 border border-white/[0.08] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-[#f5f5f7] select-none focus:outline-none',
              alignStyles[align],
              className
            )}
            {...props}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

export interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
  icon?: React.ReactNode;
}

export const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  ({ destructive = false, icon, children, className, onClick, ...props }, ref) => {
    const context = useContext(DropdownMenuContext);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      context?.setIsOpen(false);
    };

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        className={clsx(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer',
          'focus-visible:outline-none focus-visible:bg-white/[0.08]',
          destructive
            ? 'text-rose-400 hover:bg-rose-500/15 hover:text-rose-300'
            : 'text-[#a1a1a6] hover:text-[#f5f5f7] hover:bg-white/[0.06]',
          className
        )}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="flex-1">{children}</span>
      </button>
    );
  }
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx('my-1 h-px bg-white/[0.06]', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx('px-3 py-1.5 text-[11px] font-semibold text-[#86868b] uppercase tracking-wider font-mono', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';
