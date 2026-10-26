import { cn } from '../../lib/utils/cn.util.js';
import { LogoIcon } from '../../assets/icons/index.js';

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
        'inline-flex shrink-0 items-center justify-center animate-pulse',
        sizes[size],
        className,
      )}
    >
      <LogoIcon aria-hidden="true" className="h-full w-full" />
    </span>
  );
}