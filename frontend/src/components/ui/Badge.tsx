import React from 'react';
import clsx from 'clsx';
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  XCircle, 
  FileText,
  FileCheck,
  ScrollText,
  Briefcase,
  Shield
} from 'lucide-react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'status' | 'category';
  value: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'status',
  value,
  size = 'md',
  className,
}) => {
  const normalizedValue = (value || '').toUpperCase();

  // Determine colors and icons based on status/category value
  let colorClass = 'bg-neutral-800 text-neutral-400 border-neutral-700/50 shadow-neutral-900/10';
  let Icon = FileText;
  let ariaLabel = value;

  if (variant === 'status') {
    switch (normalizedValue) {
      case 'PROCESSED':
        colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-950/20';
        Icon = CheckCircle2;
        ariaLabel = 'Processed successfully';
        break;
      case 'PROCESSING':
        colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-950/20 animate-pulse';
        Icon = Loader2;
        ariaLabel = 'Processing in progress';
        break;
      case 'AWAITING_REVIEW':
        colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-950/20';
        Icon = AlertCircle;
        ariaLabel = 'Awaiting human review';
        break;
      case 'FAILED':
        colorClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-950/20';
        Icon = XCircle;
        ariaLabel = 'Processing failed';
        break;
      case 'INGESTED':
        colorClass = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20 shadow-zinc-950/20';
        Icon = FileText;
        ariaLabel = 'Document uploaded';
        break;
    }
  } else if (variant === 'category') {
    switch (normalizedValue) {
      case 'INVOICE':
        colorClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-950/20';
        Icon = FileCheck;
        ariaLabel = 'Invoice document';
        break;
      case 'RFQ':
        colorClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-purple-950/20';
        Icon = ScrollText;
        ariaLabel = 'Request for Quote';
        break;
      case 'PURCHASE_ORDER':
        colorClass = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-cyan-950/20';
        Icon = Briefcase;
        ariaLabel = 'Purchase Order';
        break;
      case 'CONTRACT':
        colorClass = 'bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-teal-950/20';
        Icon = ScrollText;
        ariaLabel = 'Contract document';
        break;
      case 'COMPLIANCE':
        colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-950/20';
        Icon = Shield;
        ariaLabel = 'Compliance certificate';
        break;
      case 'UNKNOWN':
      default:
        colorClass = 'bg-zinc-800 text-zinc-400 border-zinc-700/50';
        Icon = FileText;
        ariaLabel = 'Unknown document type';
        break;
    }
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] font-medium tracking-wide border gap-1',
    md: 'px-2.5 py-1 text-xs font-semibold tracking-wide border gap-1.5',
    lg: 'px-3.5 py-1.5 text-sm font-semibold tracking-wide border gap-2',
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={clsx(
        'inline-flex items-center rounded-full shadow-sm select-none transition-all duration-300 font-mono',
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      <Icon size={iconSizes[size]} className="shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
};
