import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { useUserPreferences } from '../settings/useUserPreferences.js';

const profileKey = (workspaceId) => ['marketplace', 'my-provider', workspaceId];
const signalsKey = (workspaceId) => ['marketplace', 'my-signals', workspaceId];

export default function PublishSignal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeWorkspace, activeWorkspaceId } = useWorkspaceContext();
  const {
    query: preferencesQuery,
    save: savePreferences,
    isSaving: isSavingExecutionPreference,
  } = useUserPreferences();
  const [validationError, setValidationError] = useState('');
  const [executionPercentage, setExecutionPercentage] = useState('');
  const [form, setForm] = useState({
    instrument: '',
    marketType: 'spot',
    direction: 'long',
    orderType: 'market',
    entry: '',
    stopLoss: '',
    takeProfit: '',
  });
  const profileQuery = useQuery({
    queryKey: profileKey(activeWorkspaceId),
    queryFn: () => marketplaceApi.getMyProvider(),
    enabled: activeWorkspace?.type === 'trader',
  });
  const provider = profileQuery.data;
  useEffect(() => {
    const savedPercentage = preferencesQuery.data?.trading?.signalExecutionPercentage;
    setExecutionPercentage(savedPercentage == null ? '' : String(savedPercentage));
  }, [preferencesQuery.data?.trading?.signalExecutionPercentage]);

  const publishMutation = useMutation({
    mutationFn: (payload) => marketplaceApi.publishSignal(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: signalsKey(activeWorkspaceId) });
      navigate(ROUTES.app.trader.signalHistory);
    },
  });
  const autoPublishMutation = useMutation({
    mutationFn: (autoPublishTrades) =>
      marketplaceApi.updateProvider(provider.id, { autoPublishTrades }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey(activeWorkspaceId) }),
  });

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const entry = form.entry.trim() ? Number(form.entry) : null;
    const stopLoss = Number(form.stopLoss);
    const takeProfit = Number(form.takeProfit);
    if (!form.instrument.trim()) {
      setValidationError('Instrument is required.');
      return;
    }
    if (form.orderType === 'limit' && (!Number.isFinite(entry) || entry <= 0)) {
      setValidationError('A limit order requires an entry price greater than zero.');
      return;
    }
    if (form.stopLoss.trim() === '' || !Number.isFinite(stopLoss) || stopLoss <= 0) {
      setValidationError('Stop loss must be greater than zero.');
      return;
    }
    if (form.takeProfit.trim() === '' || !Number.isFinite(takeProfit) || takeProfit <= 0) {
      setValidationError('Take profit must be greater than zero.');
      return;
    }
    if (
      (form.direction === 'long' && stopLoss >= takeProfit) ||
      (form.direction === 'short' && stopLoss <= takeProfit)
    ) {
      setValidationError('Take profit must be above stop loss for a long, and below it for a short.');
      return;
    }
    if (
      entry !== null &&
      ((form.direction === 'long' && !(stopLoss < entry && entry < takeProfit)) ||
        (form.direction === 'short' && !(stopLoss > entry && entry > takeProfit)))
    ) {
      setValidationError('For a limit order, entry must be between stop loss and take profit.');
      return;
    }

    setValidationError('');
    publishMutation.mutate({
      instrument: form.instrument.trim().toUpperCase(),
      marketType: form.marketType,
      direction: form.direction,
      orderType: form.orderType,
      ...(form.orderType === 'limit' ? { entry: form.entry.trim() } : {}),
      stopLoss: form.stopLoss.trim(),
      targets: [form.takeProfit.trim()],
    });
  };
  const saveExecutionPreference = async (event) => {
    event.preventDefault();
    const percentage = executionPercentage === '' ? null : Number(executionPercentage);
    if (
      percentage !== null &&
      (!Number.isFinite(percentage) || percentage < 0.01 || percentage > 100)
    ) {
      return;
    }
    await savePreferences({ trading: { signalExecutionPercentage: percentage } });
  };

  if (profileQuery.isLoading) return <LoadingState label="Checking Trader profile" />;
  if (profileQuery.isError) {
    return <p className="text-sm text-destructive" role="alert">{getErrorMessage(profileQuery.error)}</p>;
  }

  if (!provider || provider.visibility !== 'public' || provider.moderationState !== 'approved') {
    return (
      <Card>
        <CardHeader><CardTitle>Profile approval required</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can publish marketplace signals after your profile has been approved and made public.
          </p>
          <Button asChild><Link to={ROUTES.app.trader.profile}>Manage your profile</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Publish a signal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Publishing shares the setup with subscribers. If trader-side execution is configured, the trade may also be submitted to connected accounts.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 pt-4">
          <label className="flex items-start gap-3 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(provider.autoPublishTrades)}
              disabled={autoPublishMutation.isPending}
              onChange={(event) => autoPublishMutation.mutate(event.target.checked)}
            />
            Automatically publish SyncExc terminal fills
          </label>
          <p className="pl-6 text-xs text-muted-foreground">
            Only filled orders placed through this Trader workspace are captured. External exchange-app activity is not connected yet; take-profit and stop-loss orders are not inferred.
          </p>
          {autoPublishMutation.isError ? (
            <p className="pl-6 text-xs text-destructive" role="alert">
              {getErrorMessage(autoPublishMutation.error)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trader account execution</CardTitle>
          <CardDescription>
            Set the share of available balance used for each new signal on your active connected accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={saveExecutionPreference}>
            <Field label="Balance allocation per signal (%)" id="signal-execution-percentage">
              <Input
                id="signal-execution-percentage"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                inputMode="decimal"
                placeholder="Disabled"
                value={executionPercentage}
                disabled={preferencesQuery.isLoading || isSavingExecutionPreference}
                onChange={(event) => setExecutionPercentage(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              variant="outline"
              disabled={
                preferencesQuery.isLoading ||
                preferencesQuery.isError ||
                isSavingExecutionPreference ||
                (executionPercentage !== '' &&
                  (!Number.isFinite(Number(executionPercentage)) ||
                    Number(executionPercentage) < 0.01 ||
                    Number(executionPercentage) > 100))
              }
            >
              {isSavingExecutionPreference ? 'Saving…' : 'Save execution size'}
            </Button>
          </form>
          {preferencesQuery.isError ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              Could not load your execution setting: {getErrorMessage(preferencesQuery.error)}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Leave blank to disable automatic trader-side orders. Orders still require active matching accounts, exchange support for attached stop-loss and take-profit at this order type, and passing risk/permission checks. Bybit Spot protection is currently supported for limit orders; unsupported combinations are blocked and shown in Signal History.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signal details</CardTitle>
          <CardDescription>
            Enter the instrument, market, direction, order type, stop loss, and take profit. Limit orders also need an entry price.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleSubmit}>
            {publishMutation.isError ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" /> {getErrorMessage(publishMutation.error)}
              </div>
            ) : null}
            {validationError ? (
              <p className="text-sm text-destructive" role="alert">{validationError}</p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Instrument" id="signal-instrument" required>
                <Input id="signal-instrument" required maxLength={32} value={form.instrument} onChange={updateField('instrument')} placeholder="BTCUSDT" />
              </Field>
              <Field label="Market" id="signal-market" required>
                <select id="signal-market" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.marketType} onChange={updateField('marketType')}>
                  <option value="spot">Spot</option><option value="futures">Futures</option><option value="perpetual">Perpetual</option>
                </select>
              </Field>
              <Field label="Direction" id="signal-direction" required>
                <select id="signal-direction" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.direction} onChange={updateField('direction')}>
                  <option value="long">Long</option><option value="short">Short</option>
                </select>
              </Field>
              <Field label="Order type" id="signal-order-type" required>
                <select id="signal-order-type" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.orderType} onChange={updateField('orderType')}>
                  <option value="market">Market</option><option value="limit">Limit</option>
                </select>
              </Field>
              {form.orderType === 'limit' ? (
                <Field label="Entry price" id="signal-entry" required>
                  <Input id="signal-entry" type="number" min="0" step="any" value={form.entry} onChange={updateField('entry')} placeholder="Required for limit orders" required />
                </Field>
              ) : null}
              <Field label="Stop loss" id="signal-stop" required>
                <Input id="signal-stop" type="number" min="0" step="any" value={form.stopLoss} onChange={updateField('stopLoss')} placeholder="Required" required />
              </Field>
              <Field label="Take profit" id="signal-take-profit" required>
                <Input id="signal-take-profit" type="number" min="0" step="any" value={form.takeProfit} onChange={updateField('takeProfit')} placeholder="Required" required />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={publishMutation.isPending}>
                <Send className="h-4 w-4" />
                {publishMutation.isPending ? 'Publishing…' : 'Publish signal'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, id, required = false, children }) {
  return <div className="grid gap-2"><Label htmlFor={id}>{label}{required ? ' *' : ''}</Label>{children}</div>;
}
