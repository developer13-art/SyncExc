import { cn } from '../../lib/utils/cn.util.js';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
      {...props}
    />
  );
}