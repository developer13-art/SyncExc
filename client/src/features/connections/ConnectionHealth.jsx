import { Activity, AlertTriangle, CheckCircle2, WifiOff } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ConnectionHealthBadge } from '../../components/domain/connection/ConnectionHealthBadge.jsx';
import { Timeline } from '../../components/ui/Timeline.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useQuery } from '@tanstack/react-query';
import { connectionsApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { cn } from '../../lib/utils/cn.util.js';

export function ConnectionHealth({ connectionId }) {
  const healthQuery = useQuery({
    queryKey: queryKeys.connections.health(connectionId),
    queryFn: () => connectionsApi.getHealth(connectionId),
    enabled: Boolean(connectionId),
    refetchInterval: 30_000,
  });

  if (healthQuery.isLoading) {
    return <LoadingState label="Loading health" />;
  }

  const health = healthQuery.data;

  if (!health) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No health data available for this connection.
        </CardContent>
      </Card>
    );
  }

  const timelineEvents = (health.events ?? []).map((event) => ({
    id: event.id,
    title: event.title ?? event.type,
    description: event.description,
    timestamp: event.occurredAt ? formatDateTime(event.occurredAt) : null,
    icon: eventIcon(event.type),
    tone: eventTone(event.type),
  }));

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Connection Health</CardTitle>
            <ConnectionHealthBadge status={health.status} />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric
            label="Last authenticated request"
            value={
              health.lastSuccessfulRequestAt
                ? formatDateTime(health.lastSuccessfulRequestAt)
                : '—'
            }
          />
          <Metric
            label="Last account sync"
            value={
              health.lastSuccessfulSyncAt ? formatDateTime(health.lastSuccessfulSyncAt) : '—'
            }
          />
          <Metric
            label="Last stream heartbeat"
            value={
              health.lastStreamHeartbeatAt
                ? formatDateTime(health.lastStreamHeartbeatAt)
                : '—'
            }
          />
          <Metric
            label="Reconnect attempts"
            value={health.reconnectAttempts ?? 0}
            tone={health.reconnectAttempts > 0 ? 'warning' : undefined}
          />
          <Metric
            label="Request latency"
            value={health.latencyMs !== undefined ? `${health.latencyMs} ms` : '—'}
          />
          <Metric
            label="Rate-limit pressure"
            value={health.rateLimitPressure ?? 'normal'}
            tone={
              health.rateLimitPressure === 'high' || health.rateLimitPressure === 'critical'
                ? 'destructive'
                : undefined
            }
          />
          <Metric label="Environment" value={health.environment ?? 'production'} />
          <Metric label="Adapter version" value={health.adapterVersion ?? '—'} />
        </CardContent>
      </Card>

      {health.lastError ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle>Latest issue</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {health.lastError}
          </CardContent>
        </Card>
      ) : null}

      {timelineEvents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent health events</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline items={timelineEvents} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No recent health events.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-sm font-medium',
          tone === 'warning' && 'text-warning',
          tone === 'destructive' && 'text-destructive',
          !tone && 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function eventIcon(type) {
  if (type?.includes('disconnect') || type?.includes('unavailable')) {
    return WifiOff;
  }
  if (type?.includes('warning') || type?.includes('degrade')) {
    return AlertTriangle;
  }
  if (type?.includes('recovery') || type?.includes('restored')) {
    return CheckCircle2;
  }
  return Activity;
}

function eventTone(type) {
  if (type?.includes('disconnect') || type?.includes('unavailable')) {
    return 'destructive';
  }
  if (type?.includes('warning') || type?.includes('degrade')) {
    return 'warning';
  }
  if (type?.includes('recovery') || type?.includes('restored')) {
    return 'success';
  }
  return undefined;
}