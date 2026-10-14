import { cn } from '../../lib/utils/cn.util.js';

const sizes = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-2',
  xl: 'h-12 w-12 border-3',
};

export function Spinner({ size = 'md', className, label = 'Loading' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-current border-r-transparent text-primary',
        sizes[size],
        className,
      )}
    />
  );
}