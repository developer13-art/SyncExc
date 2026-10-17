import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { sourcesApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';

const MODES = [
  { value: 'monitor_only', label: 'Monitor only', detail: 'Collect and parse messages; do not prepare orders.' },
  { value: 'review', label: 'Review before execution', detail: 'Require a human review before an execution intent.' },
  { value: 'simulate', label: 'Simulation only', detail: 'Exchange handoff is disabled; start simulations from the Simulation area.' },
  { value: 'live', label: 'Live execution', detail: 'Allows live intent creation after risk and permission checks.' },
];

export default function SourceExecutionConfig({ sourceId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['sources', sourceId, 'execution-config'];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => sourcesApi.getExecutionConfig(sourceId),
    enabled: Boolean(sourceId),
  });
  const [mode, setMode] = useState('review');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [maxLeverage, setMaxLeverage] = useState('');
  const [riskPerTradePct, setRiskPerTradePct] = useState('');
  const [allowedSymbols, setAllowedSymbols] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setMode(data.mode ?? 'review');
    setSelectedAccounts((data.destinations ?? []).filter((item) => item.enabled).map((item) => item.account_id));
    setMaxLeverage(data.settings?.maxLeverage ?? '');
    setRiskPerTradePct(data.settings?.riskPerTradePct ?? data.settings?.maxRiskPercent ?? '');
    setAllowedSymbols((data.settings?.allowedSymbols ?? []).join(', '));
  }, [data]);

  const toggleAccount = (accountId) => {
    setSelectedAccounts((current) => current.includes(accountId)
      ? current.filter((id) => id !== accountId)
      : [...current, accountId]);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const settings = {
        ...(maxLeverage !== '' ? { maxLeverage: Number(maxLeverage) } : {}),
        ...(riskPerTradePct !== '' ? { riskPerTradePct: Number(riskPerTradePct) } : {}),
        ...(allowedSymbols.trim()
          ? { allowedSymbols: [...new Set(allowedSymbols.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))] }
          : {}),
      };
      await sourcesApi.updateExecutionConfig(sourceId, {
        mode,
        settings,
        destinationAccountIds: selectedAccounts,
      });
      await queryClient.invalidateQueries({ queryKey });
      toast.success('Execution configuration saved');
    } catch (err) {
      toast.error('Could not save configuration', { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading execution configuration" />;
  if (error) {
    return (
      <Alert variant="warning" title="Execution configuration unavailable">
        <p className="text-xs">{getErrorMessage(error)}</p>
      </Alert>
    );
  }

  const accounts = data?.availableDestinations ?? [];

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <Alert variant={mode === 'live' ? 'warning' : 'info'} title="Execution safety">
        <p className="text-xs">
          Saving this configuration never places an order. Live intents still require source
          authorization, signal validation, user review, risk checks and an active destination.
          Simulation never uses live exchange connections; saving this setting does not start a simulation.
        </p>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Execution mode</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {MODES.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${
                mode === option.value ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <input
                type="radio"
                name="execution-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => {
                  setMode(option.value);
                  if (['monitor_only', 'simulate'].includes(option.value)) setSelectedAccounts([]);
                }}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destination accounts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {accounts.length ? accounts.map((account) => (
            <label key={account.account_id} className="flex items-start gap-3 rounded-md border border-border p-3">
              <input
                type="checkbox"
                checked={selectedAccounts.includes(account.account_id)}
                onChange={() => toggleAccount(account.account_id)}
                className="mt-1"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{account.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {account.exchange_code} · {account.account_type} · {account.environment}
                </span>
              </span>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </label>
          )) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No active exchange accounts are available in this workspace. Connect one before
              configuring execution destinations.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signal limits</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="source-max-leverage">Maximum leverage</Label>
            <Input id="source-max-leverage" type="number" min="1" max="125" step="0.1"
              value={maxLeverage} onChange={(event) => setMaxLeverage(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="source-max-risk">Risk per trade (%)</Label>
            <Input id="source-max-risk" type="number" min="0.01" max="5" step="0.01"
              value={riskPerTradePct} onChange={(event) => setRiskPerTradePct(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="source-symbols">Allowed symbols</Label>
            <Input id="source-symbols" value={allowedSymbols}
              onChange={(event) => setAllowedSymbols(event.target.value)}
              placeholder="BTCUSDT, ETHUSDT" />
          </div>
        </CardContent>
      </Card>

      {mode === 'live' ? (
        <p className="flex items-center gap-2 text-xs text-amber-700" role="note">
          <AlertTriangle className="h-4 w-4" />
          Live mode is an explicit setting. It does not bypass review, account permissions or risk controls.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : `Save version ${data?.version ? data.version + 1 : 1}`}
        </Button>
      </div>
    </form>
  );
}
