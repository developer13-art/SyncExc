import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { JsonViewer } from '../../components/ui/JsonViewer.jsx';
import { auditApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export default function AuditDetails() {
  const { eventId } = useParams();

  const eventQuery = useQuery({
    queryKey: ['audit', eventId],
    queryFn: () => auditApi.get(eventId),
    enabled: Boolean(eventId),
  });

  if (eventQuery.isLoading) {
    return <LoadingState label="Loading audit event" />;
  }

  if (eventQuery.error || !eventQuery.data) {
    return (
      <ErrorState
        title="Unable to load audit event"
        description="This audit event could not be retrieved."
        onRetry={eventQuery.refetch}
      />
    );
  }

  const event = eventQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/audit">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {event.action?.replace(/_/g, ' ') ?? 'Audit event'}
            </h1>
            <Badge variant={event.outcome === 'success' ? 'success' : 'warning'}>
              {event.outcome ?? 'recorded'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">{event.id}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Actor" value={event.actorName ?? event.actorId ?? '—'} />
          <Field
            label="Acting role"
            value={event.actorRole ?? '—'}
          />
          <Field label="Action" value={event.action ?? '—'} />
          <Field label="Module" value={event.module ?? '—'} />
          <Field label="Target type" value={event.targetType ?? '—'} />
          <Field label="Target ID" value={event.targetId ?? '—'} mono />
          <Field label="Workspace scope" value={event.workspaceId ?? '—'} mono />
          <Field label="Outcome" value={event.outcome ?? '—'} />
          <Field
            label="Timestamp (UTC)"
            value={event.occurredAt ? formatDateTime(event.occurredAt) : '—'}
          />
          <Field label="Correlation ID" value={event.correlationId ?? '—'} mono />
          <Field label="Request ID" value={event.requestId ?? '—'} mono />
          <Field label="Reason" value={event.reason ?? '—'} />
        </CardContent>
      </Card>

      {event.beforeAfter ? (
        <Card>
          <CardHeader>
            <CardTitle>Before / after</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                Before
              </p>
              <JsonViewer data={event.beforeAfter.before ?? {}} />
            </div>
            <div>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                After
              </p>
              <JsonViewer data={event.beforeAfter.after ?? {}} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {event.approvalReference ? (
        <Card>
          <CardHeader>
            <CardTitle>Approval reference</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xs text-foreground">
              {event.approvalReference}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {event.securityMetadata ? (
        <Card>
          <CardHeader>
            <CardTitle>Security context (sanitized)</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonViewer data={event.securityMetadata} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          mono
            ? 'mt-0.5 truncate font-mono text-2xs text-foreground'
            : 'mt-0.5 text-sm font-medium text-foreground'
        }
      >
        {value}
      </p>
    </div>
  );
}