import React from 'react';
import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return <div className={clsx('skeleton h-4 w-full', className)} />;
};

export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={clsx(
        'glass-card p-6 flex flex-col gap-4 border border-white/[0.08] bg-[#121217]/85 backdrop-blur-2xl rounded-3xl w-full shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]',
        className
      )}
    >
      <Skeleton className="h-4 w-1/3 opacity-80" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-3/4 opacity-60 mt-2" />
    </div>
  );
};

export const TableRowSkeleton: React.FC = () => {
  return (
    <tr className="border-b border-white/[0.06]">
      <td className="py-4 px-4"><Skeleton className="h-5 w-8 rounded-lg" /></td>
      <td className="py-4 px-4"><Skeleton className="h-4 w-32" /></td>
      <td className="py-4 px-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
      <td className="py-4 px-4"><Skeleton className="h-3 w-24 rounded-full" /></td>
      <td className="py-4 px-4"><Skeleton className="h-4 w-16" /></td>
      <td className="py-4 px-4"><Skeleton className="h-4 w-8 rounded-lg ml-auto" /></td>
    </tr>
  );
};

export const ChartSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={clsx(
        'glass-card p-6 flex flex-col gap-4 h-[300px] bg-[#121217]/85 border border-white/[0.08] backdrop-blur-2xl rounded-3xl justify-between shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]',
        className
      )}
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-3 w-1/3 opacity-60" />
      </div>
      <div className="flex items-end gap-2 h-44 px-2">
        <Skeleton className="h-[20%] w-full rounded-t-lg" />
        <Skeleton className="h-[45%] w-full rounded-t-lg" />
        <Skeleton className="h-[30%] w-full rounded-t-lg" />
        <Skeleton className="h-[75%] w-full rounded-t-lg" />
        <Skeleton className="h-[50%] w-full rounded-t-lg" />
        <Skeleton className="h-[90%] w-full rounded-t-lg" />
        <Skeleton className="h-[60%] w-full rounded-t-lg" />
      </div>
    </div>
  );
};

export const AvatarSkeleton: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className,
}) => {
  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };
  return <div className={clsx('skeleton rounded-full shrink-0', sizeMap[size], className)} />;
};

export const TextSkeleton: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => {
  return (
    <div className={clsx('flex flex-col gap-2 w-full', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx(
            'h-3.5',
            i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full',
            i > 0 && 'opacity-70'
          )}
        />
      ))}
    </div>
  );
};
