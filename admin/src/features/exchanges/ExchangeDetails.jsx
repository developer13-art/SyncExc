import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, PauseCircle, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Timeline } from '../../components/ui/Timeline.jsx';
import { CapabilityMatrix } from './CapabilityMatrix.jsx';
import { RestrictionDialog } from './RestrictionDialog.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { exchangesApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export default function ExchangeDetails() {
  const { exchangeId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [restrictOpen, setRestrictOpen] = useState(false);

  const exchangeQuery = useQuery({
    queryKey: ['exchange', exchangeId],
    queryFn: () => exchangesApi.get(exchangeId),
    enabled: Boolean(exchangeId),
  });

  const healthQuery = useQuery({
    queryKey: ['exchange', exchangeId, 'health'],
    queryFn: () => exchangesApi.health(exchangeId),
    enabled: Boolean(exchangeId),
    refetchInterval: 60_000,
  });

  const capabilitiesQuery = useQuery({
    queryKey: ['exchange', exchangeId, 'capabilities'],
    queryFn: () => exchangesApi.capabilities(exchangeId),
    enabled: Boolean(exchangeId),
  });

  const restrictMutation = useMutation({
    mutationFn: (payload) => exchangesApi.restrict(exchangeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange', exchangeId] });
      toast.success('Restriction applied');
      setRestrictOpen(false);
    },
    onError: (err) => {
      toast.error('Failed to apply restriction', { description: getErrorMessage(err) });
    },
  });

  const healthCheckMutation = useMutation({
    mutationFn: () => exchangesApi.healthCheck(exchangeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange', exchangeId, 'health'] });
      toast.success('Health check started');
    },
    onError: (err) => {
      toast.error('Health check failed', { description: getErrorMessage(err) });
    },
  });

  useEffect(() => {
    if (exchangeQuery.data) {
      dispatch(adminUiActions.setPageTitle(exchangeQuery.data.displayName ?? 'Exchange'));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Exchanges', path: '/exchanges' },
          {
            label: exchangeQuery.data.displayName ?? 'Exchange',
            path: `/exchanges/${exchangeId}`,
          },
        ]),
      );
    }
  }, [exchangeQuery.data, dispatch, exchangeId]);

  if (exchangeQuery.isLoading) {
    return <LoadingState label="Loading exchange" />;
  }

  if (exchangeQuery.error || !exchangeQuery.data) {
    return (
      <ErrorState
        title="Unable to load exchange"
        description="This exchange integration could not be retrieved."
        onRetry={exchangeQuery.refetch}
      />
    );
  }

  const exchange = exchangeQuery.data;
  const health = healthQuery.data;
  const capabilities = capabilitiesQuery.data ?? [];

  const timelineEvents = (health?.events ?? []).map((event) => ({
    id: event.id,
    title: event.title ?? event.type,
    description: event.description,
    timestamp: event.occurredAt ? formatDateTime(event.occurredAt) : null,
    tone: event.tone,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/exchanges">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {exchange.displayName}
            </h1>
            <Badge variant={exchange.integrationStatus === 'available' ? 'success' : 'warning'}>
              {exchange.integrationStatus?.replace(/_/g, ' ') ?? 'unknown'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">
            Adapter {exchange.adapterVersion ?? '—'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => healthCheckMutation.mutate()}
            disabled={healthCheckMutation.isPending}
          >
            <RefreshCw className="h-4 w-4" />
            {healthCheckMutation.isPending ? 'Checking…' : 'Trigger health check'}
          </Button>
          <Button variant="outline" onClick={() => setRestrictOpen(true)}>
            <PauseCircle className="h-4 w-4" /> Apply restriction
          </Button>
        </div>
      </div>

      {exchange.integrationStatus === 'degraded' || exchange.integrationStatus === 'maintenance' ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4 pt-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-muted-foreground">
              This integration is currently {exchange.integrationStatus}. Degraded status is
              applied at the smallest safe scope — unrelated exchanges and read-only functions
              may remain available.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Integration summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Adapter version" value={exchange.adapterVersion ?? '—'} />
          <Field label="Environment" value={exchange.environment ?? 'production'} />
          <Field label="Regions" value={(exchange.regions ?? []).join(', ') || '—'} />
          <Field
            label="Active connections"
            value={exchange.connectionCount ?? 0}
          />
          <Field
            label="Last capability validation"
            value={
              exchange.lastCapabilityValidationAt
                ? formatDateTime(exchange.lastCapabilityValidationAt)
                : '—'
            }
          />
          <Field
            label="Operational owner"
            value={exchange.operationalOwner ?? '—'}
          />
          <Field label="Rate-limit state" value={health?.rateLimitPressure ?? 'normal'} />
          <Field
            label="24h failure rate"
            value={
              exchange.failureRate24h !== undefined
                ? `${(exchange.failureRate24h * 100).toFixed(2)}%`
                : '—'
            }
          />
        </CardContent>
      </Card>

      <CapabilityMatrix exchangeId={exchangeId} capabilities={capabilities} />

      {timelineEvents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent events</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline items={timelineEvents} />
          </CardContent>
        </Card>
      ) : null}

      <RestrictionDialog
        open={restrictOpen}
        onOpenChange={setRestrictOpen}
        exchange={exchange}
        capabilities={capabilities}
        onSubmit={(payload) => restrictMutation.mutate(payload)}
        isSubmitting={restrictMutation.isPending}
      />
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