import { useState } from 'react';
import { Pause, Play, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
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
  formatList,
  formatMoney,
  formatPercentValue,
  formatPrice,
  humanize,
  statusVariant,
} from './official-trader.utils.js';

const PAUSE_SCOPES = [
  { value: 'workspace', label: 'Whole official workspace (global stop)' },
  { value: 'exchange_adapter', label: 'One exchange adapter' },
  { value: 'destination_account', label: 'One destination account' },
];

export default function RiskManagement() {
  useOfficialTraderPage('Risk management');
  const toast = useToast();
  const queryClient = useQueryClient();
  const stepUp = useStepUpAuth();

  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [pauseForm, setPauseForm] = useState({ scope: 'workspace', scopeRef: '', reason: '' });
  const [formError, setFormError] = useState(null);

  const riskQuery = useQuery({
    queryKey: ['official-trader', 'risk'],
    queryFn: officialTraderApi.risk,
  });
  const eventsQuery = useQuery({
    queryKey: ['official-trader', 'events', { limit: 50 }],
    queryFn: () => officialTraderApi.events({ limit: 50 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['official-trader'] });

  const pauseMutation = useMutation({
    mutationFn: officialTraderApi.pause,
    onSuccess: (result) => {
      setPauseOpen(false);
      setPauseForm({ scope: 'workspace', scopeRef: '', reason: '' });
      toast.success('Emergency pause recorded', {
        description: result?.notStopped?.length
          ? `${result.notStopped.length} item(s) were not stopped. The pause report lists every scope.`
          : 'New official executions are blocked.',
      });
      invalidate();
    },
    onError: (error) => toast.error('Pause failed', { description: getErrorMessage(error) }),
  });

  const resumeMutation = useMutation({
    mutationFn: ({ reason, pauseId }) => officialTraderApi.resume({ reason, pauseId }),
    onSuccess: () => {
      toast.success('Pause resumed');
      invalidate();
    },
    onError: (error) => toast.error('Resume failed', { description: getErrorMessage(error) }),
  });

  const data = riskQuery.data;
  const limits = data?.limits ?? {};
  const pauses = data?.pauses ?? [];

  if (riskQuery.isLoading) {
    return <LoadingState label="Loading official risk state" />;
  }
  if (riskQuery.isError) {
    return (
      <ErrorState
        title="Risk state unavailable"
        description={getErrorMessage(riskQuery.error)}
        onRetry={riskQuery.refetch}
      />
    );
  }

  const handlePause = () => {
    const reason = pauseForm.reason.trim();
    if (reason.length < 10) return setFormError('A reason of at least 10 characters is required.');
    if (pauseForm.scope !== 'workspace' && !pauseForm.scopeRef.trim()) {
      return setFormError('A scope reference is required for this pause scope.');
    }
    setFormError(null);
    stepUp.requiresStepUp({
      reason: `Emergency pause: ${reason}`,
      run: () => pauseMutation.mutateAsync({
        scope: pauseForm.scope,
        scopeRef: pauseForm.scope === 'workspace' ? null : pauseForm.scopeRef.trim(),
        reason,
      }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Risk management"
        description="Official execution is constrained by deterministic risk checks and emergency pause scopes. The AI cannot change platform risk limits or exchange permissions."
      >
        <IconButton label="Refresh risk state" onClick={() => { riskQuery.refetch(); eventsQuery.refetch(); }} className="border border-border">
          <RefreshCw className={riskQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
        <Button onClick={() => setPauseOpen(true)}>
          <Pause className="h-4 w-4" /> Emergency pause
        </Button>
        <Button variant="outline" onClick={() => setResumeOpen(true)} disabled={pauses.length === 0}>
          <Play className="h-4 w-4" /> Resume
        </Button>
      </PageHeader>

      <Alert
        variant="warning"
        title="Pause behaviour is explicit"
        description="A pause does not cancel orders already accepted by an exchange and does not automatically close positions. The pause response reports exactly what was and was not stopped."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Trader status"
          value={humanize(limits.status)}
          icon={ShieldCheck}
          tone={limits.status === 'enabled' ? 'success' : 'warning'}
        />
        <StatCard
          label="Realized today"
          value={formatMoney(data?.realizedToday)}
          hint="From reconciled closures only"
        />
        <StatCard
          label="Exposure today"
          value={formatMoney(data?.exposure?.notional)}
          hint={`${data?.exposure?.entries ?? 0} entries`}
        />
        <StatCard
          label="Active pauses"
          value={pauses.length}
          hint="Workspace or platform scope"
          tone={pauses.length ? 'warning' : 'default'}
          icon={ShieldAlert}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured execution limits</CardTitle>
          <CardDescription>These limits are enforced by deterministic validation before any order is submitted.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Max risk per trade', formatPercentValue(limits.maxRiskPerTradePct)],
              ['Max order notional', formatMoney(limits.maxOrderNotional)],
              ['Max open positions', limits.maxOpenPositions ?? '—'],
              ['Max daily exposure', formatMoney(limits.maxDailyExposure)],
              ['Max leverage', limits.maxLeverage ?? '—'],
              ['Max daily loss', formatMoney(limits.maxDailyLoss)],
              ['Max drawdown', formatPercentValue(limits.maxDrawdownPct)],
              ['Max slippage', limits.maxSlippageBps == null ? '—' : `${limits.maxSlippageBps} bps`],
              ['Publication mode', humanize(limits.publicationMode)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
            <p><span className="text-foreground">Markets:</span> {formatList(limits.allowedMarketTypes)}</p>
            <p><span className="text-foreground">Strategies:</span> {formatList(limits.allowedStrategies)}</p>
            <p>
              <span className="text-foreground">Stop-loss required:</span> {limits.requireStopLoss ? 'Yes' : 'No'} ·{' '}
              <span className="text-foreground">Copy trading:</span> {limits.copyTradingEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open official executions</CardTitle>
          <CardDescription>Open positions are never counted as realized performance.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={[
              { key: 'instrument', label: 'Instrument' },
              { key: 'market_type', label: 'Market', render: (row) => humanize(row.market_type) },
              { key: 'side', label: 'Side', render: (row) => humanize(row.side) },
              { key: 'filled_quantity', label: 'Filled', render: (row) => formatPrice(row.filled_quantity) },
              { key: 'average_fill_price', label: 'Avg fill', render: (row) => formatPrice(row.average_fill_price) },
              { key: 'status', label: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge> },
              { key: 'created_at', label: 'Opened', render: (row) => formatDateTime(row.created_at) },
            ]}
            rows={data?.openExecutions ?? []}
            emptyTitle="No open official executions"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active emergency pauses</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={[
              {
                key: 'scope',
                label: 'Scope',
                render: (row) => (
                  <div>
                    <p className="text-sm text-foreground">{humanize(row.scope_type)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{row.scope_id || 'workspace-wide'}</p>
                  </div>
                ),
              },
              { key: 'reason', label: 'Reason', render: (row) => <span className="text-sm">{row.reason}</span> },
              { key: 'status', label: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge> },
              { key: 'created_at', label: 'Requested', render: (row) => formatDateTime(row.created_at) },
              { key: 'initiated_by', label: 'By', render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.initiated_by ? row.initiated_by.slice(0, 8) : 'system'}</span> },
            ]}
            rows={pauses}
            emptyTitle="No active pauses"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle events</CardTitle>
          <CardDescription>Every sensitive administrative action is audited separately from these lifecycle events.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {eventsQuery.isLoading ? (
            <LoadingState label="Loading events" />
          ) : (
            <DataTable
              columns={[
                { key: 'created_at', label: 'Time', render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span> },
                { key: 'event_type', label: 'Event', render: (row) => <Badge variant="outline">{humanize(row.event_type)}</Badge> },
                { key: 'message', label: 'Message', render: (row) => <span className="text-sm">{row.message || '—'}</span> },
                { key: 'actor_id', label: 'Actor', render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.actor_id ? row.actor_id.slice(0, 8) : 'system'}</span> },
              ]}
              rows={eventsQuery.data?.items ?? []}
              emptyTitle="No events recorded"
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={pauseOpen}
        onOpenChange={(open) => {
          if (!pauseMutation.isPending) setPauseOpen(open);
        }}
        title="Emergency pause"
        description="Blocks new official executions at the selected scope. Existing exchange-accepted orders and open positions are not canceled or closed."
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
                setFormError(null);
              }}
              placeholder="Explain why this pause is required"
            />
          </label>
          {formError ? (
            <p className="text-xs text-destructive" role="alert">{formError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              The initiating administrator, reason, and scope are recorded. Step-up verification is required.
            </p>
          )}
        </div>
      </Modal>

      <ReasonDialog
        open={resumeOpen}
        onOpenChange={setResumeOpen}
        title="Resume official trader"
        description="Resuming clears active pauses. Trading resumes only when no active pauses remain and risk configuration is valid."
        confirmLabel="Resume"
        isLoading={resumeMutation.isPending}
        onConfirm={(reason) => {
          stepUp.requiresStepUp({
            reason: `Resume official trader: ${reason}`,
            run: () => resumeMutation.mutateAsync({ reason }),
          });
        }}
      />

      <StepUpGate stepUp={stepUp} />
    </div>
  );
}
