'use client';

import React, { createContext, useContext, useState, useId } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (val: string) => void;
  tabGroupId: string;
}

const TabsContext = createContext<TabsContextType | null>(null);

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (val: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  className,
  children,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const tabGroupId = useId();
  const isControlled = controlledValue !== undefined;
  const activeTab = isControlled ? controlledValue : internalValue;

  const setActiveTab = (val: string) => {
    if (!isControlled) {
      setInternalValue(val);
    }
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, tabGroupId }}>
      <div className={clsx('flex flex-col gap-4 w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
};

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'segmented' | 'pills' | 'underline';
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, variant = 'segmented', ...props }, ref) => {
    const variantStyles = {
      segmented:
        'bg-white/[0.04] p-1 rounded-2xl border border-white/[0.08] backdrop-blur-2xl inline-flex items-center gap-1',
      pills:
        'bg-transparent inline-flex items-center gap-2 p-0.5',
      underline:
        'bg-transparent inline-flex items-center gap-6 border-b border-white/[0.08]',
    };

    return (
      <div
        ref={ref}
        role="tablist"
        className={clsx('select-none overflow-x-auto scrollbar-none', variantStyles[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, children, icon, badge, className, disabled, ...props }, ref) => {
    const context = useContext(TabsContext);
    if (!context) throw new Error('TabsTrigger must be used within Tabs');
    const { activeTab, setActiveTab, tabGroupId } = context;
    const isActive = activeTab === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        disabled={disabled}
        onClick={() => setActiveTab(value)}
        className={clsx(
          'relative z-10 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors duration-150 inline-flex items-center gap-2',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1 focus-visible:ring-offset-black',
          'disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
          isActive ? 'text-white font-semibold' : 'text-[#a1a1a6] hover:text-[#f5f5f7]',
          className
        )}
        {...props}
      >
        {isActive && (
          <motion.div
            layoutId={`active-tab-${tabGroupId}`}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
            className="absolute inset-0 z-[-1] rounded-xl bg-white/[0.12] border border-white/[0.16] shadow-sm backdrop-blur-md"
          />
        )}
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
        {badge && <span className="shrink-0">{badge}</span>}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, children, ...props }, ref) => {
    const context = useContext(TabsContext);
    if (!context) throw new Error('TabsContent must be used within Tabs');
    const { activeTab } = context;

    if (activeTab !== value) return null;

    return (
      <motion.div
        ref={ref}
        role="tabpanel"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={clsx('focus-visible:outline-none focus:outline-none', className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
TabsContent.displayName = 'TabsContent';
