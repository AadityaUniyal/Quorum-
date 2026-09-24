import React from 'react';
import { LucideIcon, FolderOpen } from 'lucide-react';
import clsx from 'clsx';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    disabled?: boolean;
    className?: string;
  };
  illustration?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
  illustration,
  compact = false,
  className,
}) => {
  const ActionIcon = action?.icon;

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6 px-4' : 'py-16 px-4',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Illustration or Icon */}
      {illustration ? (
        <div className={compact ? 'mb-3' : 'mb-6'} aria-hidden="true">
          {illustration}
        </div>
      ) : (
        <div
          className={clsx(
            'rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5',
            compact ? 'mb-3 p-3' : 'mb-6 p-6'
          )}
        >
          <Icon
            className={clsx(
              'text-blue-400/60',
              compact ? 'h-8 w-8' : 'h-16 w-16'
            )}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Title */}
      <h3
        className={clsx(
          'font-bold text-foreground mb-2',
          compact ? 'text-base' : 'text-xl'
        )}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className={clsx(
          'text-muted-foreground leading-relaxed',
          compact ? 'text-xs max-w-xs mb-4' : 'text-sm max-w-md mb-6'
        )}
      >
        {description}
      </p>

      {/* Action Button */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className={clsx(
            action.className ||
              (compact
                ? 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium text-xs transition-all duration-200 shadow-md shadow-primary/20 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
                : 'inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed')
          )}
          aria-label={action.label}
        >
          {ActionIcon && <ActionIcon size={compact ? 14 : 16} aria-hidden="true" />}
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

