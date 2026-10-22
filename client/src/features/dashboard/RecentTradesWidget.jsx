import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { TradeStatusBadge } from '../../components/domain/trade/TradeStatusBadge.jsx';
import { PnLIndicator } from '../../components/domain/trade/PnLIndicator.jsx';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function RecentTradesWidget({ trades = [], isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Unable to load recent trades.</p>
        </CardContent>
      </Card>
    );
  }

  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No recent trades"
            description="Closed and filled trades will appear here."
            size="sm"
            className="border-0 bg-transparent py-6"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Trades</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.app.terminal.trades}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border p-0">
        {trades.slice(0, 5).map((trade) => (
          <div
            key={trade.id}
            className="flex items-center justify-between gap-3 px-5 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {trade.instrument ?? trade.symbol}
                </p>
                <TradeStatusBadge status={trade.status} />
              </div>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                <span
                  className={cn(
                    'mr-1 font-medium uppercase',
                    trade.side === 'buy' || trade.side === 'long'
                      ? 'text-success'
                      : 'text-destructive',
                  )}
                >
                  {trade.side}
                </span>
                {formatQuantity(trade.filledQuantity ?? trade.quantity, 6)} @{' '}
                {formatQuantity(trade.averagePrice ?? trade.price, 6)}
                {' · '}
                {trade.closedAt ? formatRelativeTime(trade.closedAt) : ''}
              </p>
            </div>
            <PnLIndicator
              value={trade.realizedPnl}
              percent={trade.pnlPercent}
              currency={trade.quoteCurrency ?? 'USD'}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}