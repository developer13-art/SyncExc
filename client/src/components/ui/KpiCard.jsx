import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  direction = 'flat',
  className,
}) {
  const DirectionIcon =
    direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
  const directionClass =
    direction === 'up'
      ? 'text-success'
      : direction === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 shadow-sm', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      {delta !== undefined ? (
        <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', directionClass)}>
          <DirectionIcon className="h-3 w-3" />
          <span>{delta}</span>
          {deltaLabel ? <span className="text-muted-foreground">{deltaLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}