import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const Label = forwardRef(function Label(
  { className, required, children, ...props },
  ref,
) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    >
      {children}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </LabelPrimitive.Root>
  );
});

Label.displayName = 'Label';