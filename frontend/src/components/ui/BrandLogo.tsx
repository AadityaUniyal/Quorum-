import React from 'react';
import clsx from 'clsx';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className,
}) => {
  const iconDimensions = {
    sm: { w: 24, h: 24, text: 'text-sm', badge: 'text-[9px] px-1 py-0.2' },
    md: { w: 32, h: 32, text: 'text-base', badge: 'text-[10px] px-1.5 py-0.5' },
    lg: { w: 42, h: 42, text: 'text-xl', badge: 'text-xs px-2 py-0.5' },
    xl: { w: 56, h: 56, text: 'text-2xl', badge: 'text-xs px-2.5 py-1' },
  }[size];

  return (
    <div className={clsx('flex items-center gap-2.5 select-none shrink-0', className)}>
      {/* Signature Neural Prism Vector Logo */}
      <svg
        width={iconDimensions.w}
        height={iconDimensions.h}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_2px_10px_rgba(37,99,235,0.35)] transition-transform hover:scale-105 duration-200"
      >
        <defs>
          <linearGradient id="docIntelBrandGrad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="60%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>
          <linearGradient id="facetHighlight" x1="12" y1="6" x2="28" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="nodeConnection" x1="14" y1="20" x2="24" y2="14" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
        </defs>

        {/* Outer Prism Geometry */}
        <path
          d="M6 9C6 7.34315 7.34315 6 9 6H20L28 14V27C28 28.6569 26.6569 30 25 30H9C7.34315 30 6 28.6569 6 27V9Z"
          fill="#0B132B"
          stroke="#1E293B"
          strokeWidth="1.5"
        />

        {/* Cognitive Facet Fold */}
        <path
          d="M12 11C12 9.89543 12.8954 9 14 9H23L29 15V24C29 25.1046 28.1046 26 27 26H14C12.8954 26 12 25.1046 12 24V11Z"
          fill="url(#docIntelBrandGrad)"
        />

        {/* Corner Fold Reflection */}
        <path
          d="M20 6V13C20 13.5523 20.4477 14 21 14H28"
          stroke="#38BDF8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Neural Nodes & Verification Links */}
        <path
          d="M15 22L19 17L24 14"
          stroke="url(#nodeConnection)"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="15" cy="22" r="2" fill="#FFFFFF" />
        <circle cx="19" cy="17" r="2.2" fill="#60A5FA" stroke="#FFFFFF" strokeWidth="0.8" />
        <circle cx="24" cy="14" r="2" fill="#93C5FD" />
      </svg>

      {/* Brand Wordmark */}
      {showWordmark && (
        <div className="flex items-center gap-1.5 font-sans tracking-tight">
          <span className={clsx('font-extrabold text-foreground', iconDimensions.text)}>
            Quo<span className="text-primary font-bold">rum</span>
          </span>
          <span
            className={clsx(
              'font-mono font-bold tracking-wider rounded-md uppercase bg-primary/15 text-primary border border-primary/25',
              iconDimensions.badge
            )}
          >
            AI
          </span>
        </div>
      )}
    </div>
  );
};
