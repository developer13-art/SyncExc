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
import {
  TraderSignalExecutionReadiness,
  useTraderSignalExecutionReadiness,
} from './TraderSignalExecutionReadiness.jsx';

const profileKey = (workspaceId) => ['marketplace', 'my-provider', workspaceId];
const signalsKey = (workspaceId) => ['marketplace', 'my-signals', workspaceId];

export default function PublishSignal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeWorkspace, activeWorkspaceId } = useWorkspaceContext();
  const [validationError, setValidationError] = useState('');
  const [executionAmount, setExecutionAmount] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [form, setForm] = useState({
    instrument: '',
    marketType: 'spot',
    direction: 'long',
    orderType: 'market',
    entry: '',
    stopLoss: '',
    takeProfit: '',
  });
  const executionReadiness = useTraderSignalExecutionReadiness({
    marketType: form.marketType,
    direction: form.direction,
    orderType: form.orderType,
  });
  const compatibleAccountKey = executionReadiness.compatibleAccounts
    .map(({ account }) => account.id)
    .sort()
    .join('|');
  const canRunPreflight = Boolean(
    form.instrument.trim() &&
    selectedAccountIds.length > 0 &&
    Number(executionAmount) > 0 &&
    Number(form.stopLoss) > 0 &&
    Number(form.takeProfit) > 0 &&
    (form.orderType !== 'limit' || Number(form.entry) > 0),
  );
  const preflightPayload = {
    instrument: form.instrument.trim().toUpperCase(),
    marketType: form.marketType,
    direction: form.direction,
    orderType: form.orderType,
    ...(form.orderType === 'limit' ? { entry: form.entry.trim() } : {}),
    stopLoss: form.stopLoss.trim(),
    targets: [form.takeProfit.trim()],
    executionAccountIds: selectedAccountIds,
    executionAmount: executionAmount.trim(),
  };
  const preflightQuery = useQuery({
    queryKey: ['marketplace', 'signal-preflight', activeWorkspaceId, preflightPayload],
    queryFn: () => marketplaceApi.preflightSignal(preflightPayload),
    enabled: canRunPreflight,
    staleTime: 0,
    refetchInterval: canRunPreflight ? 15_000 : false,
  });
  const selectedAccountsReady = canRunPreflight &&
    !preflightQuery.isError &&
    preflightQuery.isSuccess &&
    preflightQuery.data?.ready === true &&
    Array.isArray(preflightQuery.data?.accounts) &&
    preflightQuery.data.accounts.length === selectedAccountIds.length &&
    preflightQuery.data.accounts.every((account) => account.valid);
  const profileQuery = useQuery({
    queryKey: profileKey(activeWorkspaceId),
    queryFn: () => marketplaceApi.getMyProvider(),
    enabled: activeWorkspace?.type === 'trader',
  });
  const provider = profileQuery.data;
  useEffect(() => {
    setSelectedAccountIds(compatibleAccountKey ? compatibleAccountKey.split('|') : []);
  }, [compatibleAccountKey]);

  const publishMutation = useMutation({
    mutationFn: (payload) => marketplaceApi.publishSignal(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: signalsKey(activeWorkspaceId) });
      navigate(ROUTES.app.trader.signalHistory);
    },
  });
  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const entry = form.entry.trim() ? Number(form.entry) : null;
    const stopLoss = Number(form.stopLoss);
    const takeProfit = Number(form.takeProfit);
    const size = Number(executionAmount);
    if (!Number.isFinite(size) || size <= 0) {
      setValidationError('Trade size must be a positive quote-currency amount.');
      return;
    }
    if (selectedAccountIds.length === 0) {
      setValidationError('Select at least one connected exchange account.');
      return;
    }
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
    publishMutation.mutate(preflightPayload);
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
          Review the trader-account execution check below before publishing. A signal cannot be published until a protected execution path is available for at least one active account.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 pt-4">
          <p className="text-sm font-medium text-foreground">
            Confirmed SyncExc trades publish automatically
          </p>
          <p className="text-xs text-muted-foreground">
            Confirmed fills routed through SyncExc are shared with subscribers when this Trader profile is public and approved. Trade size and account details are not included in the marketplace signal.
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
              <Field label="Trade size (quote currency)" id="signal-execution-amount" required>
                <Input
                  id="signal-execution-amount"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={executionAmount}
                  onChange={(event) => setExecutionAmount(event.target.value)}
                  placeholder="Applied separately to each selected account"
                  required
                />
              </Field>
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium text-foreground">Trader execution accounts *</legend>
              {executionReadiness.activeAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active exchange accounts are available in this workspace.</p>
              ) : (
                <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                  {executionReadiness.activeAccounts.map(({ connection, account }) => (
                    <label key={account.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(account.id)}
                        onChange={(event) => setSelectedAccountIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, account.id])]
                            : current.filter((id) => id !== account.id)
                        )}
                      />
                      <span>{connection.exchangeName || connection.exchange || 'Exchange'} · {account.name || account.accountType || 'Account'}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Trade size and selected accounts remain private. Every selected account must pass the exchange, asset, protection, and balance checks before publishing is enabled.
              </p>
            </fieldset>
            <TraderSignalExecutionReadiness
              readiness={executionReadiness}
              marketType={form.marketType}
              direction={form.direction}
              orderType={form.orderType}
              selectedAccountCount={selectedAccountIds.length}
            />
            {canRunPreflight ? (
              <div className="grid gap-2" aria-live="polite">
                {preflightQuery.isFetching ? (
                  <p className="text-sm text-muted-foreground">Checking each selected exchange’s asset support, account health, protection requirements, and available balance…</p>
                ) : null}
                {preflightQuery.isError ? (
                  <p className="text-sm text-destructive" role="alert">
                    Pre-flight validation failed: {getErrorMessage(preflightQuery.error)}. Publishing is disabled until validation succeeds.
                  </p>
                ) : null}
                {preflightQuery.data?.accounts?.filter((account) => !account.valid).map((account) => (
                  <p key={account.accountId} className="text-sm text-destructive" role="alert">
                    {account.exchangeCode || 'Exchange'}: {account.reason || 'This account did not pass pre-flight validation.'}
                  </p>
                ))}
                {selectedAccountsReady ? (
                  <p className="text-sm text-emerald-700" role="status">All selected accounts passed pre-flight validation. Balances and market conditions will be checked again immediately before execution.</p>
                ) : null}
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  publishMutation.isPending ||
                  preflightQuery.isFetching ||
                  !selectedAccountsReady ||
                  !executionReadiness.canPublish ||
                  selectedAccountIds.length === 0 ||
                  !Number.isFinite(Number(executionAmount)) ||
                  Number(executionAmount) <= 0
                }
              >
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
