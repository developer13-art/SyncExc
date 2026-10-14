import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { JsonViewer } from '../../components/ui/JsonViewer.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { signalsApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function IntentDetails() {
  const { intentId } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const intentQuery = useQuery({
    queryKey: queryKeys.signals.intent(intentId),
    queryFn: () => signalsApi.getIntent(intentId),
    enabled: Boolean(intentId),
    refetchInterval: 15_000,
  });

  const cancelMutation = useMutation({
    mutationFn: () => signalsApi.cancelIntent(intentId, { reason: 'User-cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.signals.intent(intentId) });
      toast.success('Cancellation requested');
    },
    onError: (err) => {
      toast.error('Cancellation failed', { description: getErrorMessage(err) });
    },
  });

  if (intentQuery.isLoading) {
    return <LoadingState label="Loading intent" />;
  }

  if (intentQuery.error || !intentQuery.data) {
    return (
      <ErrorState
        title="Unable to load intent"
        description="This execution intent could not be retrieved."
        onRetry={intentQuery.refetch}
      />
    );
  }

  const intent = intentQuery.data;
  const canCancel = ['pending', 'awaiting_approval', 'held'].includes(intent.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.signals.intents}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {intent.instrument ?? 'Execution intent'}
            </h1>
            <Badge variant={statusVariant(intent.status)}>{intent.status ?? 'pending'}</Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">{intent.id}</p>
        </div>
        {canCancel ? (
          <Button
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            <XCircle className="h-4 w-4" />
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel intent'}
          </Button>
        ) : null}
      </div>

      {intent.status === 'reconciliation_required' ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            The outcome of this intent is uncertain. Reconciliation against authoritative
            state is required before any retry.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Intent details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Direction" value={intent.direction?.toUpperCase() ?? '—'} />
          <Field label="Source signal" value={intent.sourceSignalId ?? '—'} />
          <Field label="Signal version" value={intent.signalVersion ?? '—'} />
          <Field label="Sync group" value={intent.syncGroupId ?? '—'} />
          <Field
            label="Created"
            value={intent.createdAt ? formatDateTime(intent.createdAt) : '—'}
          />
          <Field
            label="Expires"
            value={intent.expiresAt ? formatDateTime(intent.expiresAt) : '—'}
          />
          <Field label="Idempotency key" value={intent.idempotencyKey ?? '—'} />
          <Field label="Correlation" value={intent.correlationId ?? '—'} />
        </CardContent>
      </Card>

      {intent.riskEvaluation ? (
        <Card>
          <CardHeader>
            <CardTitle>Risk evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonViewer data={intent.riskEvaluation} />
          </CardContent>
        </Card>
      ) : null}

      {intent.payload ? (
        <Card>
          <CardHeader>
            <CardTitle>Intent payload</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonViewer data={intent.payload} />
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

function statusVariant(status) {
  if (status === 'completed' || status === 'executed') {
    return 'success';
  }
  if (status === 'failed' || status === 'blocked' || status === 'reconciliation_required') {
    return 'destructive';
  }
  if (status === 'pending' || status === 'awaiting_approval' || status === 'held') {
    return 'warning';
  }
  return 'muted';
}