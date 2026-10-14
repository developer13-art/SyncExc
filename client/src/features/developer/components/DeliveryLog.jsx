import { RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';

const STATUS_VARIANTS = {
  delivered: 'success',
  pending: 'muted',
  queued: 'muted',
  delivering: 'info',
  retry_scheduled: 'warning',
  failed: 'destructive',
  dead_lettered: 'destructive',
  suspended: 'destructive',
};

export function DeliveryLog({
  deliveries = [],
  isLoading,
  onReplay,
  onRefresh,
  replayingId,
}) {
  if (isLoading) {
    return <LoadingState label="Loading deliveries" />;
  }

  if (deliveries.length === 0) {
    return (
      <EmptyState
        title="No deliveries yet"
        description="Webhook deliveries will appear here as events are dispatched."
        size="sm"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        {onRefresh ? (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {deliveries.map((delivery) => (
          <li key={delivery.id}>
            <Card>
              <CardContent className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs font-medium text-foreground">
                        {delivery.eventType ?? 'event'}
                      </code>
                      <Badge variant={STATUS_VARIANTS[delivery.status] ?? 'muted'}>
                        {delivery.status?.replace(/_/g, ' ') ?? 'unknown'}
                      </Badge>
                      {delivery.attemptNumber !== undefined ? (
                        <span className="text-2xs text-muted-foreground">
                          attempt {delivery.attemptNumber}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-2xs text-muted-foreground">
                      {delivery.eventId ?? delivery.id}
                    </p>
                    {delivery.errorCategory ? (
                      <p className="mt-1 text-xs text-destructive">
                        {delivery.errorCategory}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                    {delivery.responseStatus ? (
                      <span>HTTP {delivery.responseStatus}</span>
                    ) : null}
                    {delivery.durationMs !== undefined ? (
                      <span>{delivery.durationMs}ms</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-2xs text-muted-foreground">
                  <span>
                    {delivery.attemptedAt ? formatDateTime(delivery.attemptedAt) : ''}
                  </span>
                  {onReplay && delivery.status !== 'delivered' ? (
                    <button
                      type="button"
                      onClick={() => onReplay?.(delivery)}
                      disabled={replayingId === delivery.id}
                      className="text-primary hover:underline disabled:opacity-50"
                    >
                      {replayingId === delivery.id ? 'Replaying…' : 'Replay'}
                    </button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}