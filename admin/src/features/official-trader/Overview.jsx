import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Pause,
  Play,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { officialTraderApi } from '../../api/index.js';
import { getErrorMessage } from '../../lib/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { useStepUpAuth } from '../../hooks/useStepUpAuth.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { PageHeader } from './components/PageHeader.jsx';
import { ReasonDialog } from './components/ReasonDialog.jsx';
import { StepUpGate } from './components/StepUpGate.jsx';
import { useOfficialTraderPage } from './hooks/useOfficialTraderPage.js';
import {
  formatPercentValue,
  humanize,
  statusVariant,
} from './official-trader.utils.js';

const PAUSE_SCOPES = [
  { value: 'workspace', label: 'Whole official workspace (global stop)' },
  { value: 'exchange_adapter', label: 'One exchange adapter' },
  { value: 'destination_account', label: 'One destination account' },
];

function sumStatuses(counts) {
  return Object.values(counts ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

export default function OfficialTraderOverview() {
  useOfficialTraderPage('Official AI Trader');
  const toast = useToast();
  const queryClient = useQueryClient();
  const stepUp = useStepUpAuth();

  const [researchOpen, setResearchOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [pauseForm, setPauseForm] = useState({ scope: 'workspace', scopeRef: '', reason: '' });
  const [pauseError, setPauseError] = useState(null);

  const overviewQuery = useQuery({
    queryKey: ['official-trader', 'overview'],
    queryFn: officialTraderApi.overview,
  });
  const eventsQuery = useQuery({
    queryKey: ['official-trader', 'events', { limit: 8 }],
    queryFn: () => officialTraderApi.events({ limit: 8 }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['official-trader'] });
  };

  const researchMutation = useMutation({
    mutationFn: ({ reason }) => officialTraderApi.runResearch({ reason }),
    onSuccess: (result) => {
      setResearchOpen(false);
      if (result?.skipped) {
        toast.info('Research skipped', { description: result.reason });
      } else {
        toast.success('Research run completed', {
          description: `${result?.analysesCreated ?? 0} analyses created.`,
        });
      }
      invalidate();
    },
    onError: (error) =>
      toast.error('Research run failed', { description: getErrorMessage(error) }),
  });

  const validateMutation = useMutation({
    mutationFn: ({ reason }) => officialTraderApi.validatePending({ limit: 10, reason }),
    onSuccess: (result) => {
      setValidateOpen(false);
      toast.success('Pending analyses validated', {
        description: `${result?.validated ?? 0} analysis attempt(s) recorded.`,
      });
      invalidate();
    },
    onError: (error) =>
      toast.error('Validation failed', { description: getErrorMessage(error) }),
  });

  const reconcileMutation = useMutation({
    mutationFn: () => officialTraderApi.reconcile({}),
    onSuccess: (result) => {
      toast.success('Reconciliation completed', {
        description: result?.reconciled == null
          ? 'Exchange records were checked.'
          : `${result.reconciled} execution(s) reconciled.`,
      });
      invalidate();
    },
    onError: (error) =>
      toast.error('Reconciliation failed', { description: getErrorMessage(error) }),
  });

  const snapshotMutation = useMutation({
    mutationFn: () => officialTraderApi.snapshot({}),
    onSuccess: () => {
      toast.success('Performance snapshot stored');
      invalidate();
    },
    onError: (error) =>
      toast.error('Snapshot failed', { description: getErrorMessage(error) }),
  });

  const pauseMutation = useMutation({
    mutationFn: officialTraderApi.pause,
    onSuccess: (result) => {
      setPauseOpen(false);
      setPauseForm({ scope: 'workspace', scopeRef: '', reason: '' });
      toast.success('Official trader paused', {
        description: result?.notStopped?.length
          ? `${result.notStopped.length} item(s) were not stopped. Review the pause report.`
          : 'New official executions are blocked.',
      });
      invalidate();
    },
    onError: (error) =>
      toast.error('Pause failed', { description: getErrorMessage(error) }),
  });

  const resumeMutation = useMutation({
    mutationFn: ({ reason }) => officialTraderApi.resume({ reason }),
    onSuccess: () => {
      toast.success('Official trader resumed');
      invalidate();
    },
    onError: (error) =>
      toast.error('Resume failed', { description: getErrorMessage(error) }),
  });

  const data = overviewQuery.data;
  const settings = data?.settings;
  const metrics = data?.performance?.metrics;
  const counts = data?.counts;

  if (overviewQuery.isLoading) {
    return <LoadingState label="Loading Official AI Trader" />;
  }
  if (overviewQuery.isError) {
    return (
      <ErrorState
        title="Official AI Trader unavailable"
        description={getErrorMessage(overviewQuery.error)}
        onRetry={overviewQuery.refetch}
      />
    );
  }

  const handlePause = () => {
    const reason = pauseForm.reason.trim();
    if (reason.length < 10) {
      setPauseError('A reason of at least 10 characters is required.');
      return;
    }
    if (pauseForm.scope !== 'workspace' && !pauseForm.scopeRef.trim()) {
      setPauseError('A scope reference is required for this pause scope.');
      return;
    }
    setPauseError(null);
    const payload = {
      scope: pauseForm.scope,
      scopeRef: pauseForm.scope === 'workspace' ? null : pauseForm.scopeRef.trim(),
      reason,
    };
    stepUp.requiresStepUp({
      reason: `Emergency pause: ${reason}`,
      run: () => pauseMutation.mutateAsync(payload),
    });
  };

  const eventColumns = [
    {
      key: 'created_at',
      label: 'Time',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'event_type',
      label: 'Event',
      render: (row) => <Badge variant="outline">{humanize(row.event_type)}</Badge>,
    },
    {
      key: 'message',
      label: 'Message',
      render: (row) => (
        <span className="text-sm text-foreground">{row.message || '—'}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Official AI Trader"
        description="Execution-backed official trading operations. Performance is derived only from exchange-reconciled executions and closed trades."
      >
        <IconButton
          label="Refresh overview"
          onClick={() => {
            overviewQuery.refetch();
            eventsQuery.refetch();
          }}
          className="border border-border"
        >
          <RefreshCw className={overviewQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
        <Button variant="outline" onClick={() => setValidateOpen(true)}>
          <ClipboardCheck className="h-4 w-4" /> Validate pending
        </Button>
        <Button variant="outline" onClick={() => reconcileMutation.mutate()} disabled={reconcileMutation.isPending}>
          <RefreshCw className={reconcileMutation.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Reconcile
        </Button>
        <Button onClick={() => setResearchOpen(true)}>
          <Search className="h-4 w-4" /> Run research
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(settings?.status)} size="lg">
          {humanize(settings?.status)}
        </Badge>
        <Badge variant={settings?.executionEnabled ? 'warning' : 'muted'} size="lg">
          Execution {settings?.executionEnabled ? 'enabled' : 'disabled'}
        </Badge>
        <Badge variant={settings?.researchEnabled ? 'success' : 'muted'} size="lg">
          Research {settings?.researchEnabled ? 'enabled' : 'disabled'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Last research {settings?.lastResearchAt ? formatDateTime(settings.lastResearchAt) : '—'} ·
          Last execution {settings?.lastExecutionAt ? formatDateTime(settings.lastExecutionAt) : '—'} ·
          Last reconciled {settings?.lastReconciledAt ? formatDateTime(settings.lastReconciledAt) : '—'}
        </span>
      </div>

      {settings?.status !== 'enabled' ? (
        <Alert
          variant="warning"
          title="Official trader is not enabled"
          description="New research or execution actions are blocked until an administrator resumes the trader."
          action={
            <Button size="sm" variant="outline" onClick={() => setResumeOpen(true)}>
              <Play className="h-4 w-4" /> Resume
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Closed trades"
          value={metrics?.closedTrades ?? 0}
          hint="Exchange-reconciled only"
          icon={Activity}
        />
        <StatCard
          label="Win rate"
          value={formatPercentValue(metrics?.winRate)}
          hint={`${metrics?.wins ?? 0} wins · ${metrics?.losses ?? 0} losses · ${metrics?.breakeven ?? 0} breakeven`}
          icon={ClipboardCheck}
        />
        <StatCard
          label="Realized PnL"
          value={metrics?.realizedPnl ?? '0'}
          hint={`Fees ${metrics?.fees ?? '0'}`}
          icon={AlertTriangle}
        />
        <StatCard
          label="Open positions"
          value={data?.performance?.open?.openPositions ?? 0}
          hint="Not counted as realized"
          icon={Activity}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Analyses" value={sumStatuses(counts?.analyses)} hint="All analysis records" />
        <StatCard label="Executions" value={sumStatuses(counts?.executions)} hint="All execution attempts" />
        <StatCard label="Research runs" value={counts?.researchRuns ?? 0} hint="Scheduled and manual" />
        <StatCard
          label="Exchange assignments"
          value={data?.connections?.length ?? 0}
          hint="Administrator-connected accounts"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => snapshotMutation.mutate()} disabled={snapshotMutation.isPending}>
          <Activity className="h-4 w-4" />
          {snapshotMutation.isPending ? 'Storing snapshot…' : 'Store performance snapshot'}
        </Button>
        <Button variant="destructive" onClick={() => setPauseOpen(true)}>
          <Pause className="h-4 w-4" /> Emergency pause
        </Button>
        <Link to="/official-trader/executions" className="text-sm text-primary hover:underline self-center">
          View execution management
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exchange accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {data?.connections?.length ? (
            <DataTable
              rows={data.connections}
              columns={[
                {
                  key: 'label',
                  label: 'Label',
                  render: (row) => (
                    <div>
                      <p className="text-sm font-medium text-foreground">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.exchangeCode} · {row.accountType}</p>
                    </div>
                  ),
                },
                {
                  key: 'environment',
                  label: 'Environment',
                  render: (row) => <Badge variant="outline">{humanize(row.environment)}</Badge>,
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge>,
                },
                {
                  key: 'isDefault',
                  label: 'Default',
                  render: (row) => (row.isDefault ? <Badge variant="info">Default</Badge> : '—'),
                },
              ]}
              emptyTitle="No exchange accounts"
            />
          ) : (
            <Alert
              variant="info"
              title="No official exchange account connected"
              description="Connect an exchange account with read and trade permissions only. Withdrawal permissions must never be enabled."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent lifecycle events</CardTitle>
          <Link to="/official-trader/risk" className="text-xs text-primary hover:underline">
            Risk &amp; event history
          </Link>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {eventsQuery.isLoading ? (
            <LoadingState label="Loading events" />
          ) : (
            <DataTable
              columns={eventColumns}
              rows={eventsQuery.data?.items ?? []}
              emptyTitle="No events recorded"
              emptyDescription="Official trader lifecycle events will appear here."
            />
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={researchOpen}
        onOpenChange={setResearchOpen}
        title="Run official research now"
        description="Research uses live market data. The AI may propose analyses, but execution still requires deterministic validation, risk checks, and administrator action."
        confirmLabel="Run research"
        isLoading={researchMutation.isPending}
        onConfirm={(reason) => researchMutation.mutateAsync({ reason })}
      />

      <ReasonDialog
        open={validateOpen}
        onOpenChange={setValidateOpen}
        title="Validate pending analyses"
        description="Runs deterministic validation and risk checks on up to ten pending official analyses. Nothing is executed by this action."
        confirmLabel="Validate pending"
        isLoading={validateMutation.isPending}
        onConfirm={(reason) => validateMutation.mutateAsync({ reason })}
      />

      <ReasonDialog
        open={resumeOpen}
        onOpenChange={setResumeOpen}
        title="Resume the official trader"
        description="Resuming re-enables research and execution gating only when no emergency pauses remain active. Exchange-accepted orders and open positions are not affected."
        confirmLabel="Resume trader"
        isLoading={resumeMutation.isPending}
        onConfirm={(reason) => {
          stepUp.requiresStepUp({
            reason: `Resume official trader: ${reason}`,
            run: () => resumeMutation.mutateAsync({ reason }),
          });
        }}
      />

      <Modal
        open={pauseOpen}
        onOpenChange={(open) => {
          if (!pauseMutation.isPending) setPauseOpen(open);
        }}
        title="Emergency pause"
        description="Pausing blocks new official executions. It does not cancel orders already accepted by an exchange or close existing positions. The pause report states exactly what was and was not stopped."
        footer={
          <>
            <Button variant="outline" onClick={() => setPauseOpen(false)} disabled={pauseMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handlePause} disabled={pauseMutation.isPending}>
              {pauseMutation.isPending ? 'Pausing…' : 'Pause official trader'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Pause scope
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={pauseForm.scope}
              onChange={(event) => setPauseForm((current) => ({ ...current, scope: event.target.value }))}
            >
              {PAUSE_SCOPES.map((scope) => (
                <option key={scope.value} value={scope.value}>{scope.label}</option>
              ))}
            </select>
          </label>
          {pauseForm.scope !== 'workspace' ? (
            <label className="grid gap-1 text-sm font-medium">
              Scope reference
              <input
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={pauseForm.scopeRef}
                onChange={(event) => setPauseForm((current) => ({ ...current, scopeRef: event.target.value }))}
                placeholder={pauseForm.scope === 'exchange_adapter' ? 'Exchange code, e.g. bybit' : 'Destination account ID'}
              />
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-medium">
            Reason
            <Textarea
              rows={3}
              value={pauseForm.reason}
              onChange={(event) => {
                setPauseForm((current) => ({ ...current, reason: event.target.value }));
                setPauseError(null);
              }}
              placeholder="Explain why this pause is required"
            />
          </label>
          {pauseError ? (
            <p className="text-xs text-destructive" role="alert">{pauseError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pause is a sensitive action and requires recent step-up verification. It is audited and
              recorded as an incident event.
            </p>
          )}
        </div>
      </Modal>


      <StepUpGate stepUp={stepUp} />
    </div>
  );
}
