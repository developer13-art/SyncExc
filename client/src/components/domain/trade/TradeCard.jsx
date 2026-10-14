import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';

import { Card } from '../../ui/Card.jsx';
import { TradeStatusBadge } from './TradeStatusBadge.jsx';
import { PnLIndicator } from './PnLIndicator.jsx';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function TradeCard({ trade, href, className }) {
  if (!trade) {
    return null;
  }

  const isLong = trade.side === 'buy' || trade.side === 'long';
  const DirectionIcon = isLong ? ArrowUpRight : ArrowDownRight;
  const linkTo = href ?? ROUTES.app.terminal.order(trade.id);

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <DirectionIcon
              className={cn('h-4 w-4 shrink-0', isLong ? 'text-success' : 'text-destructive')}
            />
            <span className="truncate text-sm font-semibold text-foreground">
              {trade.instrument ?? trade.symbol}
            </span>
            <TradeStatusBadge status={trade.status} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <div>
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Quantity</p>
            <p className="mt-0.5 font-medium text-foreground">
              {formatQuantity(trade.quantity, 6)}
            </p>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
              Filled
            </p>
            <p className="mt-0.5 font-medium text-foreground">
              {formatQuantity(trade.filledQuantity ?? 0, 6)}
            </p>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Avg Price</p>
            <p className="mt-0.5 font-medium text-foreground">
              {trade.averagePrice ? formatQuantity(trade.averagePrice, 6) : '—'}
            </p>
          </div>
          {trade.unrealizedPnl !== undefined || trade.realizedPnl !== undefined ? (
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">P&L</p>
              <PnLIndicator
                value={trade.unrealizedPnl ?? trade.realizedPnl ?? 0}
                percent={trade.pnlPercent}
                currency={trade.quoteCurrency ?? 'USD'}
                className="mt-0.5"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {trade.createdAt ? formatDateTime(trade.createdAt) : '—'}
          </span>
          {trade.accountLabel ? <span>{trade.accountLabel}</span> : null}
        </div>
      </Link>
    </Card>
  );
}