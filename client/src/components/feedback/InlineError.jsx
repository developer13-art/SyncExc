import { AlertCircle } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';

export function InlineError({ children, className }) {
  if (!children) {
    return null;
  }
  return (
    <p className={cn('flex items-center gap-1 text-xs text-destructive', className)} role="alert">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}