import { X } from 'lucide-react';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const Chip = forwardRef(function Chip(
  { className, onRemove, children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-foreground',
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
});

Chip.displayName = 'Chip';