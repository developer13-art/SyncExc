import { Activity, AlertTriangle, CheckCircle2, WifiOff } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Timeline } from '../../components/ui/Timeline.jsx';
import { useSource } from '../../hooks/useSources.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export function SourceHealth({ sourceId }) {
  const { health, isLoading } = useSource(sourceId);

  if (isLoading) {
    return <LoadingState label="Loading health" />;
  }

  if (!health) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No health data available.
        </CardContent>
      </Card>
    );
  }

  const timelineEvents = (health.events ?? []).map((event) => ({
    id: event.id,
    title: event.title ?? event.type,
    description: event.description,
    timestamp: event.occurredAt ? formatDateTime(event.occurredAt) : null,
    icon: iconForType(event.type),
    tone: toneForType(event.type),
  }));

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Health status</CardTitle>
            <Badge
              variant={
                health.status === 'healthy'
                  ? 'success'
                  : health.status === 'degraded'
                    ? 'warning'
                    : 'destructive'
              }
            >
              {health.status ?? 'unknown'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field
            label="Last successful collection"
            value={
              health.lastSuccessfulCollectionAt
                ? formatDateTime(health.lastSuccessfulCollectionAt)
                : '—'
            }
          />
          <Field
            label="Last event received"
            value={health.lastEventAt ? formatDateTime(health.lastEventAt) : '—'}
          />
          <Field
            label="Time since last event"
            value={health.timeSinceLastEvent ?? '—'}
          />
          <Field label="Reconnect attempts" value={health.reconnectAttempts ?? 0} />
          <Field label="Rate-limit pressure" value={health.rateLimitPressure ?? 'normal'} />
          <Field label="Authorization status" value={health.authorizationStatus ?? '—'} />
          <Field label="Adapter version" value={health.adapterVersion ?? '—'} />
          <Field label="Parser version" value={health.parserVersion ?? '—'} />
        </CardContent>
      </Card>

      {health.note ? (
        <Card>
          <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
            {health.note}
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

function iconForType(type) {
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

function toneForType(type) {
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