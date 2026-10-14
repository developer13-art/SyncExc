import * as SliderPrimitive from '@radix-ui/react-slider';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const Slider = forwardRef(function Slider(
  { className, ...props },
  ref,
) {
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex w-full touch-none select-none items-center',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className={cn(
            'block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
            'disabled:pointer-events-none disabled:opacity-50',
            'hover:border-primary hover:ring-2 hover:ring-primary/20',
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
});

Slider.displayName = 'Slider';