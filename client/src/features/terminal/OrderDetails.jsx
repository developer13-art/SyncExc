import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { TradeStatusBadge } from '../../components/domain/trade/TradeStatusBadge.jsx';
import { TradeTimeline } from '../../components/domain/trade/TradeTimeline.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { useQuery } from '@tanstack/react-query';
import { terminalApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function OrderDetails() {
  const { orderId } = useParams();
  const { activeWorkspaceId } = useWorkspaceContext();

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.terminal.order(activeWorkspaceId, orderId),
    queryFn: () => terminalApi.getOrder(activeWorkspaceId, orderId),
    enabled: Boolean(activeWorkspaceId && orderId),
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <LoadingState label="Loading order" />;
  }

  if (error || !order) {
    return (
      <ErrorState
        title="Unable to load order"
        description="This order could not be retrieved."
        onRetry={refetch}
      />
    );
  }

  const events = order.events ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.terminal.orders}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{order.instrument ?? order.symbol}</CardTitle>
              <p className="mt-1 font-mono text-2xs text-muted-foreground">
                {order.id}
                {order.exchangeOrderId ? ` · exchange: ${order.exchangeOrderId}` : ''}
              </p>
            </div>
            <TradeStatusBadge status={order.status} />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Side" value={order.side?.toUpperCase()} />
          <Field label="Type" value={order.type} />
          <Field label="Quantity" value={formatQuantity(order.quantity, 8)} />
          <Field label="Filled" value={formatQuantity(order.filledQuantity ?? 0, 8)} />
          <Field
            label="Price"
            value={order.price ? formatQuantity(order.price, 8) : 'Market'}
          />
          <Field
            label="Average Price"
            value={order.averagePrice ? formatQuantity(order.averagePrice, 8) : '—'}
          />
          <Field label="Time In Force" value={order.timeInForce ?? '—'} />
          <Field label="Account" value={order.accountLabel ?? '—'} />
          <Field
            label="Created"
            value={order.createdAt ? formatDateTime(order.createdAt) : '—'}
          />
          <Field
            label="Updated"
            value={order.updatedAt ? formatDateTime(order.updatedAt) : '—'}
          />
        </CardContent>
      </Card>

      {events.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <TradeTimeline events={events} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}