import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IncidentTimeline } from '../../components/domain/risk/IncidentTimeline.jsx';
import { useQuery } from '@tanstack/react-query';
import { riskApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const SEVERITY_VARIANTS = {
  critical: 'destructive',
  high: 'destructive',
  warning: 'warning',
  info: 'info',
  low: 'muted',
};

export default function IncidentDetails() {
  const { incidentId } = useParams();

  const incidentQuery = useQuery({
    queryKey: queryKeys.risk.incident(incidentId),
    queryFn: () => riskApi.getIncident(incidentId),
    enabled: Boolean(incidentId),
    refetchInterval: 30_000,
  });

  const auditQuery = useQuery({
    queryKey: queryKeys.risk.incidentAudit(incidentId),
    queryFn: () => riskApi.getIncidentAudit(incidentId),
    enabled: Boolean(incidentId),
  });

  if (incidentQuery.isLoading) {
    return <LoadingState label="Loading incident" />;
  }

  if (incidentQuery.error || !incidentQuery.data) {
    return (
      <ErrorState
        title="Unable to load incident"
        description="This incident could not be retrieved."
        onRetry={incidentQuery.refetch}
      />
    );
  }

  const incident = incidentQuery.data;
  const events = auditQuery.data ?? incident.events ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.risk.incidents}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {incident.summary ?? 'Incident'}
          </h1>
          <Badge variant={SEVERITY_VARIANTS[incident.severity] ?? 'muted'}>
            {incident.severity ?? 'unknown'}
          </Badge>
          <Badge variant={incident.status === 'resolved' ? 'success' : 'warning'}>
            {incident.status ?? 'open'}
          </Badge>
        </div>
        <p className="mt-1 font-mono text-2xs text-muted-foreground">
          {incident.id} · {incident.category?.replace(/_/g, ' ')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incident details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Category" value={incident.category?.replace(/_/g, ' ') ?? '—'} />
          <Field
            label="Detected"
            value={incident.createdAt ? formatDateTime(incident.createdAt) : '—'}
          />
          <Field label="Assigned to" value={incident.assignedTo ?? '—'} />
          <Field
            label="Affected accounts"
            value={incident.affectedAccounts?.length ?? '—'}
          />
          {incident.containmentAction ? (
            <Field label="Containment" value={incident.containmentAction} />
          ) : null}
          {incident.rootCause ? (
            <Field label="Root cause" value={incident.rootCause} />
          ) : null}
        </CardContent>
      </Card>

      {incident.description ? (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{incident.description}</p>
          </CardContent>
        </Card>
      ) : null}

      {events.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Event timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <IncidentTimeline events={events} />
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