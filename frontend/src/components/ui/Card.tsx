'use client';

import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'mica' | 'ghost';
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', interactive = false, className, children, ...props }, ref) => {
    const variantStyles = {
      default:
        'bg-[#121217]/85 backdrop-blur-2xl border border-white/[0.08] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]',
      elevated:
        'bg-[#18181F]/90 backdrop-blur-3xl border border-white/[0.10] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85)]',
      mica:
        'bg-white/[0.03] backdrop-blur-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
      ghost:
        'bg-transparent border border-white/[0.08] hover:border-white/[0.14]',
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-3xl p-6 transition-all duration-200 text-[#f5f5f7] select-none',
          variantStyles[variant],
          interactive &&
            'cursor-pointer hover:border-white/[0.18] hover:bg-[#16161d] hover:shadow-[0_20px_48px_-10px_rgba(0,0,0,0.8)] active:scale-[0.99] touch-press',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={clsx('flex flex-col gap-1.5 pb-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={clsx('text-lg font-semibold tracking-tight text-[#f5f5f7] font-sans', className)}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={clsx('text-xs text-[#a1a1a6] leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={clsx('pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx('flex items-center pt-4 border-t border-white/[0.06]', className)}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';
