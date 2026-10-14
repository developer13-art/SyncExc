import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const IconButton = forwardRef(function IconButton(
  { className, label, size = 'md', variant = 'ghost', children, ...props },
  ref,
) {
  const sizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-10 w-10',
  };

  const variants = {
    ghost: 'hover:bg-muted text-muted-foreground hover:text-foreground',
    outline: 'border border-input hover:bg-muted',
    solid: 'bg-primary text-primary-foreground hover:bg-primary/90',
    danger: 'hover:bg-destructive/10 text-destructive',
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

IconButton.displayName = 'IconButton';