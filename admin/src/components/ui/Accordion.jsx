import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = forwardRef(function AccordionItem(
  { className, ...props },
  ref,
) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn('border-b border-border', className)}
      {...props}
    />
  );
});

AccordionItem.displayName = 'AccordionItem';

export const AccordionTrigger = forwardRef(function AccordionTrigger(
  { className, children, ...props },
  ref,
) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'flex flex-1 items-center justify-between py-3 text-left text-sm font-medium transition',
          'hover:underline [&[data-state=open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});

AccordionTrigger.displayName = 'AccordionTrigger';

export const AccordionContent = forwardRef(function AccordionContent(
  { className, children, ...props },
  ref,
) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        'overflow-hidden text-sm',
        'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
        className,
      )}
      {...props}
    >
      <div className="pb-4 pt-0">{children}</div>
    </AccordionPrimitive.Content>
  );
});

AccordionContent.displayName = 'AccordionContent';