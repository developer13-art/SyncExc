import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { formatPercent } from '../../../lib/formatters/percent.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function PnLIndicator({
  value,
  percent,
  currency = 'USD',
  showIcon = true,
  showPercent = true,
  className,
}) {
  const numeric = value === null || value === undefined || value === ''
    ? Number.NaN
    : typeof value === 'number'
      ? value
      : Number(value);
  if (!Number.isFinite(numeric)) {
    return <span className={cn('text-sm text-muted-foreground', className)}>—</span>;
  }

  const isPositive = numeric > 0;
  const isZero = numeric === 0;
  const Icon = isPositive ? ArrowUp : isZero ? Minus : ArrowDown;
  const tone = isPositive ? 'text-success' : isZero ? 'text-muted-foreground' : 'text-destructive';

  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', tone, className)}>
      {showIcon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
      <span>{formatCurrency(Math.abs(numeric), currency)}</span>
      {showPercent && percent !== undefined ? (
        <span className="text-xs opacity-80">
          ({formatPercent(percent, { showSign: true, decimals: 2 })}{' '}
          {numeric < 0 ? '' : ''})
        </span>
      ) : null}
    </span>
  );
}