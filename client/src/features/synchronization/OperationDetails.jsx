import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { OperationStatusBadge } from '../../components/domain/sync/OperationStatusBadge.jsx';
import { DestinationOutcomeBadge } from '../../components/domain/sync/DestinationOutcomeBadge.jsx';
import { OperationTimeline } from '../../components/domain/sync/OperationTimeline.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { synchronizationApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function OperationDetails() {
  const { operationId } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const operationQuery = useQuery({
    queryKey: queryKeys.sync.operation(operationId),
    queryFn: () => synchronizationApi.getOperation(operationId),
    enabled: Boolean(operationId),
    refetchInterval: 15_000,
  });

  const destinationsQuery = useQuery({
    queryKey: queryKeys.sync.operationDestinations(operationId),
    queryFn: () => synchronizationApi.getOperationDestinations(operationId),
    enabled: Boolean(operationId),
    refetchInterval: 15_000,
  });

  const timelineQuery = useQuery({
    queryKey: queryKeys.sync.operationTimeline(operationId),
    queryFn: () => synchronizationApi.getOperationTimeline(operationId),
    enabled: Boolean(operationId),
    refetchInterval: 15_000,
  });

  const reconcile = useMutation({
    mutationFn: () => synchronizationApi.reconcileOperation(operationId, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.operation(operationId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.sync.operationDestinations(operationId),
      });
      toast.success('Reconciliation requested');
    },
    onError: (error) => {
      toast.error('Reconciliation failed', { description: getErrorMessage(error) });
    },
  });

  const retry = useMutation({
    mutationFn: () => synchronizationApi.retryOperation(operationId, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.operation(operationId) });
      toast.success('Retry scheduled');
    },
    onError: (error) => {
      toast.error('Retry failed', { description: getErrorMessage(error) });
    },
  });

  if (operationQuery.isLoading) {
    return <LoadingState label="Loading operation" />;
  }

  if (operationQuery.error || !operationQuery.data) {
    return (
      <ErrorState
        title="Unable to load operation"
        description="This synchronization operation could not be retrieved."
        onRetry={operationQuery.refetch}
      />
    );
  }

  const operation = operationQuery.data;
  const destinations = destinationsQuery.data ?? [];
  const timeline = timelineQuery.data ?? [];

  const requiresReconciliation = operation.status === 'reconciliation_required';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.synchronization.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      {requiresReconciliation ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            The outcome of this operation is uncertain. Reconciliation against authoritative
            exchange state is required before any retry.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {operation.instrument ?? 'Sync operation'}
            </h1>
            <OperationStatusBadge status={operation.status} />
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">{operation.id}</p>
        </div>
        <div className="flex gap-2">
          {requiresReconciliation || operation.status === 'outcome_unknown' ? (
            <Button
              variant="outline"
              onClick={() => reconcile.mutate()}
              disabled={reconcile.isPending}
            >
              <RefreshCw className="h-4 w-4" />
              {reconcile.isPending ? 'Reconciling…' : 'Reconcile'}
            </Button>
          ) : null}
          {operation.status === 'failed' || operation.status === 'partially_completed' ? (
            <Button onClick={() => retry.mutate()} disabled={retry.isPending}>
              {retry.isPending ? 'Scheduling…' : 'Retry failed destinations'}
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operation summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Source event" value={operation.sourceEventType ?? '—'} />
          <Field label="Source exchange" value={operation.sourceExchange ?? '—'} />
          <Field label="Source account" value={operation.sourceAccountLabel ?? '—'} />
          <Field
            label="Source quantity"
            value={operation.sourceQuantity ? String(operation.sourceQuantity) : '—'}
          />
          <Field
            label="Created"
            value={operation.createdAt ? formatDateTime(operation.createdAt) : '—'}
          />
          <Field
            label="Updated"
            value={operation.updatedAt ? formatDateTime(operation.updatedAt) : '—'}
          />
          <Field label="Destinations" value={destinations.length} />
          <Field
            label="Requires attention"
            value={operation.requiresAttention ? 'Yes' : 'No'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destination outcomes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {destinations.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No destination results are available yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {destinations.map((destination) => (
                <li key={destination.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {destination.exchangeName} · {destination.accountLabel ?? destination.accountId}
                      </p>
                      {destination.skipReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {destination.skipReason}
                        </p>
                      ) : null}
                      {destination.errorCategory ? (
                        <p className="mt-1 text-xs text-destructive">
                          {destination.errorCategory}
                        </p>
                      ) : null}
                    </div>
                    <DestinationOutcomeBadge outcome={destination.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                    {destination.requestedQuantity ? (
                      <div>
                        <p className="text-2xs uppercase text-muted-foreground">Requested</p>
                        <p className="font-medium text-foreground">
                          {destination.requestedQuantity}
                        </p>
                      </div>
                    ) : null}
                    {destination.filledQuantity ? (
                      <div>
                        <p className="text-2xs uppercase text-muted-foreground">Filled</p>
                        <p className="font-medium text-foreground">
                          {destination.filledQuantity}
                        </p>
                      </div>
                    ) : null}
                    {destination.exchangeOrderId ? (
                      <div>
                        <p className="text-2xs uppercase text-muted-foreground">
                          Exchange order
                        </p>
                        <p className="font-mono text-foreground">
                          {destination.exchangeOrderId}
                        </p>
                      </div>
                    ) : null}
                    {destination.reconciliationStatus ? (
                      <div>
                        <p className="text-2xs uppercase text-muted-foreground">
                          Reconciliation
                        </p>
                        <Badge
                          variant={
                            destination.reconciliationStatus === 'matched'
                              ? 'success'
                              : 'warning'
                          }
                        >
                          {destination.reconciliationStatus}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {timeline.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Event timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <OperationTimeline events={timeline} />
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