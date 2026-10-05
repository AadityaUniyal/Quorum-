'use client';

import React, { createContext, useContext, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface AccordionContextType {
  openValues: string[];
  toggleValue: (val: string) => void;
}

const AccordionContext = createContext<AccordionContextType | null>(null);

export interface AccordionProps {
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  className?: string;
  children: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({
  type = 'single',
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
}) => {
  const normalizeInitial = () => {
    if (!defaultValue) return [];
    return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  };

  const [internalValues, setInternalValues] = useState<string[]>(normalizeInitial);
  const isControlled = controlledValue !== undefined;
  const currentValues = isControlled
    ? Array.isArray(controlledValue)
      ? controlledValue
      : controlledValue
      ? [controlledValue]
      : []
    : internalValues;

  const toggleValue = (val: string) => {
    let next: string[];
    if (type === 'single') {
      next = currentValues.includes(val) ? [] : [val];
    } else {
      next = currentValues.includes(val)
        ? currentValues.filter((v) => v !== val)
        : [...currentValues, val];
    }

    if (!isControlled) {
      setInternalValues(next);
    }
    onValueChange?.(type === 'single' ? next[0] || '' : next);
  };

  return (
    <AccordionContext.Provider value={{ openValues: currentValues, toggleValue }}>
      <div className={clsx('flex flex-col divide-y divide-white/[0.08]', className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
};

interface AccordionItemContextType {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = createContext<AccordionItemContextType | null>(null);

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

export const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, className, children, ...props }, ref) => {
    const context = useContext(AccordionContext);
    if (!context) throw new Error('AccordionItem must be used within Accordion');
    const isOpen = context.openValues.includes(value);

    return (
      <AccordionItemContext.Provider value={{ value, isOpen }}>
        <div
          ref={ref}
          className={clsx('transition-colors group py-1', className)}
          {...props}
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  }
);
AccordionItem.displayName = 'AccordionItem';

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const accordionContext = useContext(AccordionContext);
    const itemContext = useContext(AccordionItemContext);
    if (!accordionContext || !itemContext) {
      throw new Error('AccordionTrigger must be used within AccordionItem');
    }

    const { isOpen, value } = itemContext;

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => accordionContext.toggleValue(value)}
        aria-expanded={isOpen}
        className={clsx(
          'w-full flex items-center justify-between py-3.5 px-2 text-left font-sans text-sm font-medium text-[#f5f5f7] transition-all cursor-pointer rounded-xl hover:bg-white/[0.03] select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1 focus-visible:ring-offset-black',
          className
        )}
        {...props}
      >
        <span className="flex-1">{children}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="shrink-0 text-[#a1a1a6] ml-3"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>
    );
  }
);
AccordionTrigger.displayName = 'AccordionTrigger';

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => {
    const itemContext = useContext(AccordionItemContext);
    if (!itemContext) throw new Error('AccordionContent must be used within AccordionItem');
    const { isOpen } = itemContext;

    return (
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            ref={ref}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="overflow-hidden"
          >
            <div className={clsx('px-2 pb-4 pt-1 text-xs text-[#a1a1a6] leading-relaxed', className)} {...props}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
AccordionContent.displayName = 'AccordionContent';
