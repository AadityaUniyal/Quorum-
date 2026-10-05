'use client';

import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-[#0071e3] hover:bg-[#0077ed] text-white border border-white/20 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_16px_rgba(0,113,227,0.35)]',
      secondary:
        'bg-[#18181F] hover:bg-[#202029] text-[#f5f5f7] border border-white/[0.08] hover:border-white/[0.16] shadow-sm',
      glass:
        'bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-white border border-white/[0.08] hover:border-white/[0.16] backdrop-blur-2xl shadow-sm',
      ghost:
        'bg-transparent hover:bg-white/[0.06] text-[#a1a1a6] hover:text-[#f5f5f7] border border-transparent',
      danger:
        'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 shadow-sm',
      outline:
        'bg-transparent hover:bg-white/[0.04] text-[#f5f5f7] border border-white/[0.12] hover:border-white/[0.24]',
    };

    const sizeStyles: Record<ButtonSize, string> = {
      xs: 'h-7 px-2.5 text-[11px] rounded-lg gap-1.5',
      sm: 'h-8 px-3 text-xs rounded-xl gap-2',
      md: 'h-9 px-4 text-xs font-medium rounded-xl gap-2',
      lg: 'h-11 px-5 text-sm font-medium rounded-2xl gap-2.5',
      xl: 'h-12 px-6 text-base font-semibold rounded-2xl gap-3',
      icon: 'h-9 w-9 p-0 rounded-xl justify-center items-center',
      'icon-sm': 'h-7 w-7 p-0 rounded-lg justify-center items-center',
    };

    const isDisabled = disabled || isLoading;

    return (
      <motion.button
        ref={ref}
        whileTap={isDisabled ? undefined : { scale: 0.97 }}
        whileHover={isDisabled ? undefined : { scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        disabled={isDisabled}
        className={clsx(
          'inline-flex items-center justify-center font-sans tracking-tight select-none transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-1 focus-visible:ring-offset-black',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
