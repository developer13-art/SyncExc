import { cva } from 'class-variance-authority';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium transition',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
        info: 'border-info/20 bg-info/10 text-info',
        muted: 'border-border bg-muted text-muted-foreground',
      },
      size: {
        sm: 'h-5 px-1.5 text-2xs',
        default: 'h-5.5 px-2 py-0.5 text-xs',
        lg: 'h-6 px-2.5 py-0.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export const Badge = forwardRef(function Badge(
  { className, variant, size, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
});

Badge.displayName = 'Badge';

export { badgeVariants };