import { AlertCircle } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';

export function FormError({ children, className }) {
  if (!children) {
    return null;
  }
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive',
        className,
      )}
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}