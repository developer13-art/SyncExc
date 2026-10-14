import * as ProgressPrimitive from '@radix-ui/react-progress';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const ProgressBar = forwardRef(function ProgressBar(
  { className, value = 0, indicatorClassName, ...props },
  ref,
) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      value={clamped}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full flex-1 bg-primary transition-all', indicatorClassName)}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});

ProgressBar.displayName = 'ProgressBar';