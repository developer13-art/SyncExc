import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const Input = forwardRef(function Input(
  { className, type = 'text', error, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition',
        'placeholder:text-muted-foreground',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-destructive focus-visible:ring-destructive',
        className,
      )}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
});

Input.displayName = 'Input';