import { cn } from '../../lib/utils/cn.util.js';
import { BrandLogo } from '../brand/BrandLogo.jsx';

const sizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

export function Spinner({ size = 'md', className, label = 'Loading' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center animate-pulse',
        sizes[size],
        className,
      )}
    >
      <BrandLogo className="h-full w-full" />
    </span>
  );
}