import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef(function TooltipContent(
  { className, sideOffset = 4, ...props },
  ref,
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 overflow-hidden rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md',
          'animate-in fade-in',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});

TooltipContent.displayName = 'TooltipContent';

export function Tooltip({ children, content, side = 'top', align = 'center', delayDuration }) {
  if (!content) {
    return children;
  }
  return (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
}