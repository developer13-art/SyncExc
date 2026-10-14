import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

const sizes = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export const Avatar = forwardRef(function Avatar(
  { className, src, alt, fallback, size = 'md', ...props },
  ref,
) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        sizes[size],
        className,
      )}
      {...props}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={alt ?? ''}
          className="aspect-square h-full w-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-muted font-medium text-muted-foreground">
        {fallback ?? '?'}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
});

Avatar.displayName = 'Avatar';