import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { TradeStatusBadge } from '../../components/domain/trade/TradeStatusBadge.jsx';
import { PnLIndicator } from '../../components/domain/trade/PnLIndicator.jsx';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function OpenTradesWidget({ positions = [], orders = [], isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Unable to load open positions.</p>
        </CardContent>
      </Card>
    );
  }

  const hasPositions = positions.length > 0;
  const hasOrders = orders.length > 0;

  if (!hasPositions && !hasOrders) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No open positions"
            description="Active positions and pending orders will appear here."
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
          <CardTitle>Open Positions</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.app.terminal.positions}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border p-0">
        {positions.slice(0, 5).map((position) => (
          <Link
            key={position.id}
            to={ROUTES.app.terminal.overview}
            className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-muted/40"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {position.instrument ?? position.symbol}
                </p>
                <span
                  className={cn(
                    'text-2xs font-medium uppercase tracking-wide',
                    position.side === 'long' || position.side === 'buy'
                      ? 'text-success'
                      : 'text-destructive',
                  )}
                >
                  {position.side}
                </span>
              </div>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                {formatQuantity(position.size ?? position.quantity, 6)} @{' '}
                {formatQuantity(position.entryPrice, 6)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <PnLIndicator
                value={position.unrealizedPnl ?? 0}
                percent={position.pnlPercent}
                currency={position.quoteCurrency ?? 'USD'}
              />
              {position.leverage ? (
                <span className="text-2xs text-muted-foreground">
                  {position.leverage}x
                </span>
              ) : null}
            </div>
          </Link>
        ))}

        {hasOrders && positions.length === 0 ? (
          <div className="px-5 py-3">
            <p className="mb-2 text-2xs uppercase tracking-wide text-muted-foreground">
              Pending orders
            </p>
            <ul className="flex flex-col gap-2">
              {orders.slice(0, 3).map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-foreground">{order.instrument ?? order.symbol}</span>
                  <TradeStatusBadge status={order.status} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}