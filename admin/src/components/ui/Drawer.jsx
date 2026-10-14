import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export const DrawerContent = forwardRef(function DrawerContent(
  { className, children, side = 'right', size = 'md', ...props },
  ref,
) {
  const sizes = {
    sm: side === 'left' || side === 'right' ? 'w-80' : 'h-64',
    md: side === 'left' || side === 'right' ? 'w-96' : 'h-80',
    lg: side === 'left' || side === 'right' ? 'w-[32rem]' : 'h-96',
    xl: side === 'left' || side === 'right' ? 'w-[42rem]' : 'h-[32rem]',
  };

  const positions = {
    right: 'right-0 top-0 h-full border-l',
    left: 'left-0 top-0 h-full border-r',
    top: 'left-0 top-0 w-full border-b',
    bottom: 'left-0 bottom-0 w-full border-t',
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 flex flex-col bg-background shadow-lg',
          positions[side],
          sizes[size],
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

DrawerContent.displayName = 'DrawerContent';

export function DrawerHeader({ className, ...props }) {
  return (
    <div
      className={cn('flex flex-col gap-1 border-b border-border px-6 py-4', className)}
      {...props}
    />
  );
}

export function DrawerBody({ className, ...props }) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto scrollbar-thin px-6 py-4', className)}
      {...props}
    />
  );
}

export function DrawerFooter({ className, ...props }) {
  return (
    <div
      className={cn('flex justify-end gap-2 border-t border-border px-6 py-4', className)}
      {...props}
    />
  );
}

export const DrawerTitle = DialogPrimitive.Title;
export const DrawerDescription = DialogPrimitive.Description;