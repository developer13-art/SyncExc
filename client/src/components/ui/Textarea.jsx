import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const Textarea = forwardRef(function Textarea(
  { className, error, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'resize-y scrollbar-thin',
        error && 'border-destructive focus-visible:ring-destructive',
        className,
      )}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';