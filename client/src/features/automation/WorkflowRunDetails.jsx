import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { RunStatusBadge } from '../../components/domain/workflow/RunStatusBadge.jsx';
import { RunTimeline } from './components/RunTimeline.jsx';
import { useWorkflowRun } from '../../hooks/useAutomation.js';
import { automationApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkflowRunDetails() {
  const { runId } = useParams();
  const toast = useToast();
  const runQuery = useWorkflowRun(runId);

  if (runQuery.isLoading) {
    return <LoadingState label="Loading run" />;
  }

  if (runQuery.error || !runQuery.run) {
    return (
      <ErrorState
        title="Unable to load run"
        description="This run could not be retrieved."
        onRetry={runQuery.refetch}
      />
    );
  }

  const run = runQuery.run;
  const steps = runQuery.steps ?? [];

  const handleCancel = async () => {
    try {
      await automationApi.cancelRun(runId, { reason: 'Manual cancellation' });
      toast.success('Cancellation requested');
      await runQuery.refetch?.();
    } catch (err) {
      toast.error('Cancellation failed', { description: getErrorMessage(err) });
    }
  };

  const canCancel = ['running', 'waiting', 'awaiting_approval'].includes(run.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.automation.workflow(run.workflowId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Run {run.id?.slice(0, 12)}
            </h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Version {run.version} · Started {run.startedAt ? formatDateTime(run.startedAt) : '—'}
          </p>
        </div>
        {canCancel ? (
          <Button variant="outline" onClick={handleCancel}>
            <XCircle className="h-4 w-4" /> Cancel run
          </Button>
        ) : null}
      </div>

      {run.status === 'reconciliation_required' ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            An external outcome is uncertain. Reconciliation against authoritative state is
            required before any retry.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Workflow" value={run.workflowName ?? '—'} />
          <Field label="Version" value={run.version ?? '—'} />
          <Field label="Trigger" value={run.triggerType?.replace(/_/g, ' ') ?? '—'} />
          <Field
            label="Duration"
            value={run.durationMs !== undefined ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
          />
          <Field label="Steps executed" value={run.stepsExecuted ?? '—'} />
          <Field label="Failed steps" value={run.failedSteps ?? 0} />
          <Field label="Retries" value={run.retryCount ?? 0} />
          <Field label="Correlation" value={run.correlationId ?? '—'} />
        </CardContent>
      </Card>

      {steps.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Steps</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {steps.map((step) => (
                <li key={step.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{step.name}</p>
                    {step.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {step.durationMs !== undefined ? (
                      <span className="text-2xs text-muted-foreground">
                        {(step.durationMs / 1000).toFixed(2)}s
                      </span>
                    ) : null}
                    <RunStatusBadge status={step.status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {run.timeline?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Event timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <RunTimeline events={run.timeline} />
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