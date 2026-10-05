'use client';

import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;
export const DialogPortal = RadixDialog.Portal;

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  className?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, showCloseButton = true, ...props }, ref) => {
    return (
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl"
          />
        </RadixDialog.Overlay>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <RadixDialog.Content asChild {...props}>
            <motion.div
              ref={ref}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className={clsx(
                'relative w-full max-w-lg rounded-3xl bg-[#0A0A0C]/95 border border-white/[0.10] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.85)] backdrop-blur-3xl text-[#f5f5f7] focus:outline-none',
                className
              )}
            >
              {children}
              {showCloseButton && (
                <RadixDialog.Close asChild>
                  <button
                    type="button"
                    className="absolute right-5 top-5 p-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.10] border border-white/[0.08] text-[#a1a1a6] hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </RadixDialog.Close>
              )}
            </motion.div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    );
  }
);
DialogContent.displayName = 'DialogContent';

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={clsx('flex flex-col gap-1.5 pb-4 border-b border-white/[0.06]', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(({ className, ...props }, ref) => (
  <RadixDialog.Title
    ref={ref}
    className={clsx('text-lg font-semibold tracking-tight text-[#f5f5f7] font-sans', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(({ className, ...props }, ref) => (
  <RadixDialog.Description
    ref={ref}
    className={clsx('text-xs text-[#a1a1a6] leading-relaxed', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={clsx('flex items-center justify-end gap-3 pt-5 border-t border-white/[0.06]', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';
