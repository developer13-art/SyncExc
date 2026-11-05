import { useEffect, useState } from 'react';
import { RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { officialTraderApi } from '../../api/index.js';
import { getErrorMessage } from '../../lib/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { useStepUpAuth } from '../../hooks/useStepUpAuth.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { PageHeader } from './components/PageHeader.jsx';
import { ReasonDialog } from './components/ReasonDialog.jsx';
import { StepUpGate } from './components/StepUpGate.jsx';
import { useOfficialTraderPage } from './hooks/useOfficialTraderPage.js';
import { humanize, statusVariant } from './official-trader.utils.js';

const TIMEFRAMES = ['5m', '15m', '30m', '1h', '2h', '4h', '1d'];
const STRATEGIES = ['trend_following', 'breakout', 'momentum'];

const EMPTY_FORM = {
  researchEnabled: false,
  executionEnabled: false,
  researchIntervalMinutes: '15',
  primaryTimeframe: '1h',
  minConfidence: '0.7',
  maxAnalysesPerRun: '5',
  spot: true,
  futures: false,
  strategies: 'trend_following,breakout,momentum',
  timeframes: ['1h', '4h'],
  maxRiskPerTradePct: '1',
  maxOrderNotional: '1000',
  maxOpenPositions: '3',
  maxDailyExposure: '5000',
  maxLeverage: '3',
  maxDailyLoss: '200',
  maxDrawdownPct: '10',
  maxSlippageBps: '50',
  publicationMode: 'execution_verified',
  requireStopLoss: true,
  copyTradingEnabled: false,
};

function toForm(settings) {
  return {
    researchEnabled: Boolean(settings.researchEnabled),
    executionEnabled: Boolean(settings.executionEnabled),
    researchIntervalMinutes: String(settings.researchIntervalMinutes ?? 15),
    primaryTimeframe: settings.primaryTimeframe || '1h',
    minConfidence: String(settings.minConfidence ?? 0.7),
    maxAnalysesPerRun: String(settings.maxAnalysesPerRun ?? 5),
    spot: (settings.allowedMarketTypes ?? []).includes('spot'),
    futures: (settings.allowedMarketTypes ?? []).includes('futures'),
    strategies: (settings.allowedStrategies ?? STRATEGIES).join(','),
    timeframes: settings.researchTimeframes ?? ['1h', '4h'],
    maxRiskPerTradePct: String(settings.maxRiskPerTradePct ?? 1),
    maxOrderNotional: String(settings.maxOrderNotional ?? 1000),
    maxOpenPositions: String(settings.maxOpenPositions ?? 3),
    maxDailyExposure: String(settings.maxDailyExposure ?? 5000),
    maxLeverage: String(settings.maxLeverage ?? 3),
    maxDailyLoss: String(settings.maxDailyLoss ?? 200),
    maxDrawdownPct: String(settings.maxDrawdownPct ?? 10),
    maxSlippageBps: String(settings.maxSlippageBps ?? 50),
    publicationMode: settings.publicationMode || 'execution_verified',
    requireStopLoss: Boolean(settings.requireStopLoss),
    copyTradingEnabled: Boolean(settings.copyTradingEnabled),
  };
}

function numeric(form, key) {
  const value = Number(form[key]);
  return Number.isFinite(value) ? value : undefined;
}

export default function OfficialTraderSettings() {
  useOfficialTraderPage('Official trader settings');
  const toast = useToast();
  const queryClient = useQueryClient();
  const stepUp = useStepUpAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [error, setError] = useState(null);

  const settingsQuery = useQuery({
    queryKey: ['official-trader', 'settings'],
    queryFn: officialTraderApi.settings,
  });

  useEffect(() => {
    if (settingsQuery.data?.settings) {
      setForm(toForm(settingsQuery.data.settings));
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({ fields, reason }) => officialTraderApi.updateSettings({ fields, reason }),
    onSuccess: () => {
      setReasonOpen(false);
      toast.success('Official trader settings updated');
      queryClient.invalidateQueries({ queryKey: ['official-trader'] });
    },
    onError: (err) => toast.error('Settings update failed', { description: getErrorMessage(err) }),
  });

  if (settingsQuery.isLoading) {
    return <LoadingState label="Loading official trader settings" />;
  }
  if (settingsQuery.isError) {
    return (
      <ErrorState
        title="Settings unavailable"
        description={getErrorMessage(settingsQuery.error)}
        onRetry={settingsQuery.refetch}
      />
    );
  }

  const data = settingsQuery.data;
  const settings = data.settings;
  const provider = data.provider;

  const buildFields = () => {
    if (!form.spot && !form.futures) {
      setError('At least one market type must be allowed.');
      return null;
    }
    if (form.timeframes.length === 0) {
      setError('Select at least one research timeframe.');
      return null;
    }
    const fields = {
      researchEnabled: form.researchEnabled,
      executionEnabled: form.executionEnabled,
      researchIntervalMinutes: numeric(form, 'researchIntervalMinutes'),
      primaryTimeframe: form.primaryTimeframe,
      minConfidence: numeric(form, 'minConfidence'),
      maxAnalysesPerRun: numeric(form, 'maxAnalysesPerRun'),
      allowedMarketTypes: [
        ...(form.spot ? ['spot'] : []),
        ...(form.futures ? ['futures'] : []),
      ],
      allowedStrategies: form.strategies.split(',').map((value) => value.trim()).filter(Boolean),
      researchTimeframes: form.timeframes,
      maxRiskPerTradePct: numeric(form, 'maxRiskPerTradePct'),
      maxOrderNotional: numeric(form, 'maxOrderNotional'),
      maxOpenPositions: numeric(form, 'maxOpenPositions'),
      maxDailyExposure: numeric(form, 'maxDailyExposure'),
      maxLeverage: numeric(form, 'maxLeverage'),
      maxDailyLoss: numeric(form, 'maxDailyLoss'),
      maxDrawdownPct: numeric(form, 'maxDrawdownPct'),
      maxSlippageBps: numeric(form, 'maxSlippageBps'),
      publicationMode: form.publicationMode,
      requireStopLoss: form.requireStopLoss,
      copyTradingEnabled: form.copyTradingEnabled,
    };
    Object.keys(fields).forEach((key) => fields[key] === undefined && delete fields[key]);
    setError(null);
    return fields;
  };

  const handleSave = () => {
    const fields = buildFields();
    if (!fields) return;
    setReasonOpen(true);
  };

  const numericField = (key, label, { min = '0', step = 'any', hint } = {}) => (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <Input
        type="number"
        min={min}
        step={step}
        value={form[key]}
        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
      />
      {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Official trader settings"
        description="These controls constrain research and execution for the platform-owned trader. They never grant the AI authority to change risk limits or exchange permissions."
      >
        <IconButton label="Refresh settings" onClick={() => settingsQuery.refetch()} className="border border-border">
          <RefreshCw className={settingsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4" /> Save settings
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(settings.status)} size="lg">{humanize(settings.status)}</Badge>
        <Badge variant="info" size="lg">{provider?.displayName}</Badge>
        <span className="text-xs text-muted-foreground">
          Handle @{provider?.handle} · Workspace {provider?.workspaceId?.slice(0, 8)} · Last research{' '}
          {formatDateTime(settings.lastResearchAt)} · Last execution {formatDateTime(settings.lastExecutionAt)}
        </span>
      </div>

      <Alert
        variant="warning"
        title="Emergency stops are separate"
        description="Use Risk Management for emergency pauses. Saving settings cannot cancel exchange-accepted orders or close positions."
      />

      {error ? <Alert variant="destructive" title="Review the form" description={error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Operating mode</CardTitle>
          <CardDescription>Execution remains gated by validation, risk checks, exchange health, and pause state.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
            <span>Research enabled</span>
            <input
              type="checkbox"
              checked={form.researchEnabled}
              onChange={(event) => setForm((current) => ({ ...current, researchEnabled: event.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
            <span>Execution enabled</span>
            <input
              type="checkbox"
              checked={form.executionEnabled}
              onChange={(event) => setForm((current) => ({ ...current, executionEnabled: event.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
            <span>Require stop-loss</span>
            <input
              type="checkbox"
              checked={form.requireStopLoss}
              onChange={(event) => setForm((current) => ({ ...current, requireStopLoss: event.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
            <span>Copy trading enabled</span>
            <input
              type="checkbox"
              checked={form.copyTradingEnabled}
              onChange={(event) => setForm((current) => ({ ...current, copyTradingEnabled: event.target.checked }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Publication mode
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.publicationMode}
              onChange={(event) => setForm((current) => ({ ...current, publicationMode: event.target.value }))}
            >
              <option value="execution_verified">Execution verified (recommended)</option>
              <option value="research_only">Research only</option>
            </select>
            <span className="text-xs font-normal text-muted-foreground">
              Research-only findings are labelled and excluded from live performance.
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Research controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-2 lg:grid-cols-3">
          {numericField('researchIntervalMinutes', 'Research interval (minutes)', { min: '5', step: '1' })}
          {numericField('maxAnalysesPerRun', 'Max analyses per run', { min: '1', step: '1' })}
          {numericField('minConfidence', 'Minimum AI confidence', { min: '0', step: '0.01', hint: '0 to 1' })}
          <label className="grid gap-1 text-sm font-medium">
            Primary timeframe
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.primaryTimeframe}
              onChange={(event) => setForm((current) => ({ ...current, primaryTimeframe: event.target.value }))}
            >
              {TIMEFRAMES.map((timeframe) => (
                <option key={timeframe} value={timeframe}>{timeframe}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Research timeframes
            <span className="flex flex-wrap gap-3">
              {TIMEFRAMES.map((timeframe) => (
                <label key={timeframe} className="flex items-center gap-2 text-sm font-normal">
                  <input
                    type="checkbox"
                    checked={form.timeframes.includes(timeframe)}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      timeframes: event.target.checked
                        ? [...current.timeframes, timeframe]
                        : current.timeframes.filter((value) => value !== timeframe),
                    }))}
                  />
                  {timeframe}
                </label>
              ))}
            </span>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Allowed markets
            <span className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-normal">
                <input
                  type="checkbox"
                  checked={form.spot}
                  onChange={(event) => setForm((current) => ({ ...current, spot: event.target.checked }))}
                />
                Spot
              </label>
              <label className="flex items-center gap-2 text-sm font-normal">
                <input
                  type="checkbox"
                  checked={form.futures}
                  onChange={(event) => setForm((current) => ({ ...current, futures: event.target.checked }))}
                />
                Futures
              </label>
            </span>
          </label>
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Allowed strategies
            <Input
              value={form.strategies}
              onChange={(event) => setForm((current) => ({ ...current, strategies: event.target.value }))}
              placeholder="trend_following, breakout, momentum"
            />
            <span className="text-xs font-normal text-muted-foreground">Comma-separated deterministic strategy keys.</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk limits</CardTitle>
          <CardDescription>Changing these values is sensitive and requires step-up verification.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-2 lg:grid-cols-4">
          {numericField('maxRiskPerTradePct', 'Max risk per trade (%)', { min: '0', step: '0.1' })}
          {numericField('maxOrderNotional', 'Max order notional')}
          {numericField('maxOpenPositions', 'Max open positions', { min: '1', step: '1' })}
          {numericField('maxDailyExposure', 'Max daily exposure')}
          {numericField('maxLeverage', 'Max leverage', { min: '1', step: '0.1' })}
          {numericField('maxDailyLoss', 'Max daily loss')}
          {numericField('maxDrawdownPct', 'Max drawdown (%)', { min: '0', step: '0.1' })}
          {numericField('maxSlippageBps', 'Max slippage (bps)', { min: '1', step: '1' })}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="text-xs text-muted-foreground">
          Every settings change is audited with the administrator, reason, before and after values. Critical risk
          changes require step-up verification.
        </p>
      </div>

      <ReasonDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title="Save official trader settings"
        description="This changes platform-owned trading constraints. It requires step-up verification and is fully audited."
        confirmLabel="Save settings"
        isLoading={updateMutation.isPending}
        onConfirm={(reason) => {
          const fields = buildFields();
          if (!fields) return;
          stepUp.requiresStepUp({
            reason: `Update official trader settings: ${reason}`,
            run: () => updateMutation.mutateAsync({ fields, reason }),
          });
        }}
      />

      <StepUpGate stepUp={stepUp} />
    </div>
  );
}
