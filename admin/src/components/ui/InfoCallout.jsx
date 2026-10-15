import { Info } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';

export function InfoCallout({ children, className }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground',
        className,
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}