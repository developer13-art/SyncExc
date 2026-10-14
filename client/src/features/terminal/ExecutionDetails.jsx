import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { useQuery } from '@tanstack/react-query';
import { terminalApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_MAP = {
  pending: { label: 'Pending', variant: 'muted' },
  validating: { label: 'Validating', variant: 'warning' },
  submitting: { label: 'Submitting', variant: 'warning' },
  acknowledged: { label: 'Acknowledged', variant: 'info' },
  partially_executed: { label: 'Partial', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
  reconciliation_required: { label: 'Reconciliation', variant: 'destructive' },
};

export function ExecutionDetails() {
  const { executionId } = useParams();
  const { activeWorkspaceId } = useWorkspaceContext();

  const { data: execution, isLoading, error, refetch } = useQuery({
    queryKey: ['terminal', 'execution', executionId],
    queryFn: () =>
      terminalApi
        .listExecutions(activeWorkspaceId, { ids: executionId })
        .then((result) => result.items?.[0]),
    enabled: Boolean(activeWorkspaceId && executionId),
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return <LoadingState label="Loading execution" />;
  }

  if (error || !execution) {
    return (
      <ErrorState
        title="Unable to load execution"
        description="This execution could not be retrieved."
        onRetry={refetch}
      />
    );
  }

  const config = STATUS_MAP[execution.status] ?? {
    label: execution.status,
    variant: 'muted',
  };
  const requiresReconciliation = execution.status === 'reconciliation_required';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.terminal.executions}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      {requiresReconciliation ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            The outcome of this execution is uncertain. Reconciliation against authoritative
            exchange state is required before any retry.
          </p>
        </div>
      ) : execution.status === 'completed' ? (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Execution completed and reconciled with the exchange.</p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{execution.instrument ?? 'Execution'}</CardTitle>
              <p className="mt-1 font-mono text-2xs text-muted-foreground">{execution.id}</p>
            </div>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Side" value={execution.side?.toUpperCase() ?? '—'} />
          <Field label="Type" value={execution.type ?? '—'} />
          <Field label="Attempts" value={execution.attempts ?? 1} />
          <Field
            label="Next retry"
            value={execution.retryAt ? formatDateTime(execution.retryAt) : '—'}
          />
          <Field
            label="Created"
            value={execution.createdAt ? formatDateTime(execution.createdAt) : '—'}
          />
          <Field
            label="Updated"
            value={execution.updatedAt ? formatDateTime(execution.updatedAt) : '—'}
          />
          <Field label="Account" value={execution.accountLabel ?? '—'} />
          <Field label="Correlation" value={execution.correlationId ?? '—'} />
        </CardContent>
      </Card>

      {execution.timeline?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {execution.timeline.map((event, i) => (
                <li key={i} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{event.title ?? event.type}</p>
                    {event.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {event.occurredAt ? formatDateTime(event.occurredAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
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