import { cn } from '../../../lib/utils/cn.util.js';
import { formatQuantity, formatNumber } from '../../../lib/formatters/number.formatter.js';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';

export function OrderBook({ bids = [], asks = [], baseAsset, quoteAsset, className }) {
  if (bids.length === 0 && asks.length === 0) {
    return (
      <EmptyState
        title="No order book data"
        description="Order book is not available for this instrument."
        size="sm"
        className="border-0 bg-transparent"
      />
    );
  }

  const maxTotal = Math.max(
    ...bids.map((b) => Number(b.total ?? b.quantity * b.price)),
    ...asks.map((a) => Number(a.total ?? a.quantity * a.price)),
  );

  return (
    <div className={cn('flex flex-col text-xs', className)}>
      <div className="grid grid-cols-3 border-b border-border px-3 py-2 text-2xs uppercase tracking-wide text-muted-foreground">
        <span>Price ({quoteAsset})</span>
        <span className="text-right">Size ({baseAsset})</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex flex-col-reverse">
        {asks.slice(0, 12).map((ask, i) => {
          const total = Number(ask.total ?? ask.quantity * ask.price);
          const depth = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          return (
            <div
              key={`ask-${i}`}
              className="relative grid grid-cols-3 px-3 py-1 transition hover:bg-muted/40"
            >
              <div
                className="absolute inset-y-0 right-0 bg-destructive/10"
                style={{ width: `${depth}%` }}
              />
              <span className="relative z-10 font-medium text-destructive">
                {formatQuantity(ask.price, 6)}
              </span>
              <span className="relative z-10 text-right text-foreground">
                {formatQuantity(ask.quantity, 6)}
              </span>
              <span className="relative z-10 text-right text-muted-foreground">
                {formatNumber(total, { maximumFractionDigits: 2 })}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-y border-border bg-muted/40 px-3 py-2">
        <span className="text-2xs uppercase tracking-wide text-muted-foreground">Spread</span>
        <span className="font-mono text-xs font-medium text-foreground">
          {bids[0] && asks[0]
            ? formatQuantity(Number(asks[0].price) - Number(bids[0].price), 6)
            : '—'}
        </span>
      </div>

      <div className="flex flex-col">
        {bids.slice(0, 12).map((bid, i) => {
          const total = Number(bid.total ?? bid.quantity * bid.price);
          const depth = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          return (
            <div
              key={`bid-${i}`}
              className="relative grid grid-cols-3 px-3 py-1 transition hover:bg-muted/40"
            >
              <div
                className="absolute inset-y-0 right-0 bg-success/10"
                style={{ width: `${depth}%` }}
              />
              <span className="relative z-10 font-medium text-success">
                {formatQuantity(bid.price, 6)}
              </span>
              <span className="relative z-10 text-right text-foreground">
                {formatQuantity(bid.quantity, 6)}
              </span>
              <span className="relative z-10 text-right text-muted-foreground">
                {formatNumber(total, { maximumFractionDigits: 2 })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}