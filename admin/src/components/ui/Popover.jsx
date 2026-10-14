import * as PopoverPrimitive from '@radix-ui/react-popover';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = forwardRef(function PopoverContent(
  { className, align = 'center', sideOffset = 6, ...props },
  ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});

PopoverContent.displayName = 'PopoverContent';