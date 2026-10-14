import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const RadioGroup = forwardRef(function RadioGroup({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cn('grid gap-2', className)}
      {...props}
    />
  );
});

RadioGroup.displayName = 'RadioGroup';

export const RadioGroupItem = forwardRef(function RadioGroupItem(
  { className, ...props },
  ref,
) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'aspect-square h-4 w-4 rounded-full border border-input bg-background shadow-sm transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-primary',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex h-full w-full items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});

RadioGroupItem.displayName = 'RadioGroupItem';