import { forwardRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export const Card = forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-slate-200 bg-white text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.04)]',
        className,
      )}
      {...props}
    />
  );
});

Card.displayName = 'Card';

export const CardHeader = forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn('flex flex-col gap-1 p-5', className)} {...props} />;
});

CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn('text-base font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  );
});

CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef(function CardDescription(
  { className, ...props },
  ref,
) {
  return <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />;
});

CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />;
});

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef(function CardFooter({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn('flex items-center gap-2 p-5 pt-0', className)} {...props} />
  );
});

CardFooter.displayName = 'CardFooter';