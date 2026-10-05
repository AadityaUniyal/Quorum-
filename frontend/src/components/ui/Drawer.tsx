'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DrawerContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  side: 'right' | 'bottom' | 'left' | 'top';
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export interface DrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: 'right' | 'bottom' | 'left' | 'top';
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  open: controlledOpen,
  onOpenChange,
  side = 'right',
  children,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setIsOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <DrawerContext.Provider value={{ isOpen, setIsOpen, side }}>
      {children}
    </DrawerContext.Provider>
  );
};

export const DrawerTrigger: React.FC<{
  children: React.ReactElement<any>;
  asChild?: boolean;
}> = ({ children }) => {
  const context = useContext(DrawerContext);
  if (!context) throw new Error('DrawerTrigger must be used within Drawer');

  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      children.props.onClick?.(e);
      context.setIsOpen(true);
    },
  });
};

export interface DrawerContentProps {
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export const DrawerContent: React.FC<DrawerContentProps> = ({
  children,
  className,
  showCloseButton = true,
}) => {
  const context = useContext(DrawerContext);
  if (!context) throw new Error('DrawerContent must be used within Drawer');
  const { isOpen, setIsOpen, side } = context;

  const sideVariants = {
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
      containerClass: 'fixed inset-y-0 right-0 w-full sm:max-w-lg border-l border-white/[0.08]',
    },
    left: {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
      containerClass: 'fixed inset-y-0 left-0 w-full sm:max-w-lg border-r border-white/[0.08]',
    },
    bottom: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
      containerClass: 'fixed inset-x-0 bottom-0 max-h-[90vh] rounded-t-3xl border-t border-white/[0.08]',
    },
    top: {
      initial: { y: '-100%' },
      animate: { y: 0 },
      exit: { y: '-100%' },
      containerClass: 'fixed inset-x-0 top-0 max-h-[90vh] rounded-b-3xl border-b border-white/[0.08]',
    },
  };

  const currentVariant = sideVariants[side];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-xl"
          />

          {/* Panel */}
          <motion.div
            initial={currentVariant.initial}
            animate={currentVariant.animate}
            exit={currentVariant.exit}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={clsx(
              'z-50 flex flex-col bg-[#0A0A0C]/95 backdrop-blur-3xl shadow-[0_32px_80px_rgba(0,0,0,0.9)] text-[#f5f5f7] overflow-hidden',
              currentVariant.containerClass,
              className
            )}
          >
            {/* Grab handle for bottom sheet */}
            {side === 'bottom' && (
              <div className="pt-3 pb-1 flex justify-center">
                <div className="w-12 h-1.5 rounded-full bg-white/20" />
              </div>
            )}

            {showCloseButton && (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-5 top-5 p-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.10] border border-white/[0.08] text-[#a1a1a6] hover:text-white transition-all cursor-pointer z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const DrawerHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={clsx('flex flex-col gap-1.5 pb-4 border-b border-white/[0.06]', className)}
    {...props}
  />
);

export const DrawerTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3
    className={clsx('text-lg font-semibold tracking-tight text-[#f5f5f7] font-sans', className)}
    {...props}
  >
    {children}
  </h3>
);

export const DrawerDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => (
  <p className={clsx('text-xs text-[#a1a1a6] leading-relaxed', className)} {...props} />
);

export const DrawerFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={clsx('flex items-center justify-end gap-3 pt-5 border-t border-white/[0.06] mt-auto', className)}
    {...props}
  />
);

export const DrawerClose: React.FC<{
  children: React.ReactElement<any>;
}> = ({ children }) => {
  const context = useContext(DrawerContext);
  if (!context) throw new Error('DrawerClose must be used within Drawer');

  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      children.props.onClick?.(e);
      context.setIsOpen(false);
    },
  });
};
