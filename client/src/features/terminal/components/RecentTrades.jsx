import { cn } from '../../../lib/utils/cn.util.js';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';
import { formatTime } from '../../../lib/formatters/date.formatter.js';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';

export function RecentTrades({ trades = [], baseAsset, quoteAsset, className }) {
  if (trades.length === 0) {
    return (
      <EmptyState
        title="No recent trades"
        description="Recent fills will appear here."
        size="sm"
        className="border-0 bg-transparent"
      />
    );
  }

  return (
    <div className={cn('flex flex-col text-xs', className)}>
      <div className="grid grid-cols-3 border-b border-border px-3 py-2 text-2xs uppercase tracking-wide text-muted-foreground">
        <span>Price ({quoteAsset})</span>
        <span className="text-right">Size ({baseAsset})</span>
        <span className="text-right">Time</span>
      </div>
      <div className="flex flex-col">
        {trades.slice(0, 20).map((trade, i) => {
          const isBuy = trade.side === 'buy';
          return (
            <div
              key={`trade-${i}`}
              className="grid grid-cols-3 px-3 py-1 transition hover:bg-muted/40"
            >
              <span className={cn('font-medium', isBuy ? 'text-success' : 'text-destructive')}>
                {formatQuantity(trade.price, 6)}
              </span>
              <span className="text-right text-foreground">
                {formatQuantity(trade.quantity, 6)}
              </span>
              <span className="text-right text-muted-foreground">
                {trade.timestamp ? formatTime(trade.timestamp) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}