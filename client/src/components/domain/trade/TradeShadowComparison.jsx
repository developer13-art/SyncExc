import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function TradeShadowComparison({ actual, shadow, currency = 'USD', className }) {
  if (!actual || !shadow) {
    return null;
  }

  const actualPnl = Number(actual.pnl ?? 0);
  const shadowPnl = Number(shadow.pnl ?? 0);
  const diff = actualPnl - shadowPnl;

  const DiffIcon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
  const diffTone = diff > 0 ? 'text-success' : diff < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <h4 className="mb-3 text-sm font-semibold text-foreground">Actual vs Shadow</h4>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">Actual</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {formatCurrency(actualPnl, currency)}
          </p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">Shadow</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {formatCurrency(shadowPnl, currency)}
          </p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">Difference</p>
          <p className={cn('mt-0.5 flex items-center gap-1 text-sm font-semibold', diffTone)}>
            <DiffIcon className="h-3 w-3" />
            {formatCurrency(Math.abs(diff), currency)}
          </p>
        </div>
      </div>
    </div>
  );
}