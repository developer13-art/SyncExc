import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownGroup = DropdownMenuPrimitive.Group;
export const DropdownPortal = DropdownMenuPrimitive.Portal;
export const DropdownSub = DropdownMenuPrimitive.Sub;
export const DropdownRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownContent = forwardRef(function DropdownContent(
  { className, sideOffset = 4, ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-fade-in',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

DropdownContent.displayName = 'DropdownContent';

export const DropdownItem = forwardRef(function DropdownItem(
  { className, inset, ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition',
        'focus:bg-muted focus:text-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
});

DropdownItem.displayName = 'DropdownItem';

export const DropdownLabel = forwardRef(function DropdownLabel(
  { className, inset, ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        'px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
});

DropdownLabel.displayName = 'DropdownLabel';

export const DropdownSeparator = forwardRef(function DropdownSeparator(
  { className, ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
});

DropdownSeparator.displayName = 'DropdownSeparator';