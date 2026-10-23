import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Send } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';

const profileKey = (workspaceId) => ['marketplace', 'my-provider', workspaceId];
const signalsKey = (workspaceId) => ['marketplace', 'my-signals', workspaceId];

export default function PublishSignal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeWorkspace, activeWorkspaceId } = useWorkspaceContext();
  const [validationError, setValidationError] = useState('');
  const [form, setForm] = useState({
    instrument: '',
    marketType: 'spot',
    direction: 'long',
    orderType: 'market',
    entryTime: '',
    entry: '',
    entryMin: '',
    entryMax: '',
    stopLoss: '',
    targets: '',
    leverage: '',
    validUntil: '',
    disclosures: '',
    sourceEvidence: '',
  });
  const profileQuery = useQuery({
    queryKey: profileKey(activeWorkspaceId),
    queryFn: () => marketplaceApi.getMyProvider(),
    enabled: activeWorkspace?.type === 'trader',
  });
  const provider = profileQuery.data;

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
    const hasEntry = Boolean(form.entry.trim());
    const hasRange = Boolean(form.entryMin.trim() || form.entryMax.trim());
    if (hasEntry === hasRange) {
      setValidationError('Enter one entry price or both ends of an entry range.');
      return;
    }
    if (form.orderType === 'limit' && !hasEntry) {
      setValidationError('Limit orders require one exact entry price, not a range.');
      return;
    }
    if (hasRange && (!form.entryMin.trim() || !form.entryMax.trim() ||
        Number(form.entryMin) > Number(form.entryMax))) {
      setValidationError('Enter a complete range with the minimum no greater than the maximum.');
      return;
    }

    const targets = form.targets
      .split(',')
      .map((target) => target.trim())
      .filter(Boolean);
    if (targets.some((target) => !Number.isFinite(Number(target)) || Number(target) <= 0)) {
      setValidationError('Take-profit targets must be positive numbers.');
      return;
    }

    setValidationError('');
    publishMutation.mutate({
      instrument: form.instrument.trim().toUpperCase(),
      marketType: form.marketType,
      direction: form.direction,
      orderType: form.orderType,
      ...(form.entryTime ? { entryTime: new Date(form.entryTime).toISOString() } : {}),
      ...(hasEntry
        ? { entry: form.entry.trim() }
        : { entryRange: { min: form.entryMin.trim(), max: form.entryMax.trim() } }),
      ...(form.stopLoss.trim() ? { stopLoss: form.stopLoss.trim() } : {}),
      ...(targets.length ? { targets } : {}),
      ...(form.leverage.trim() ? { leverage: form.leverage.trim() } : {}),
      ...(form.validUntil ? { validUntil: new Date(form.validUntil).toISOString() } : {}),
      ...(form.disclosures.trim() ? { disclosures: form.disclosures.trim() } : {}),
      ...(form.sourceEvidence.trim() ? { sourceEvidence: form.sourceEvidence.trim() } : {}),
    });
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
          This publishes signal information to marketplace subscribers. It does not submit exchange orders.
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
          <CardTitle>Signal details</CardTitle>
          <CardDescription>Optional trading parameters are not inferred if you leave them blank.</CardDescription>
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
              <Field label="Instrument" id="signal-instrument">
                <Input id="signal-instrument" required maxLength={32} value={form.instrument} onChange={updateField('instrument')} placeholder="BTCUSDT" />
              </Field>
              <Field label="Market" id="signal-market">
                <select id="signal-market" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.marketType} onChange={updateField('marketType')}>
                  <option value="spot">Spot</option><option value="futures">Futures</option><option value="perpetual">Perpetual</option>
                </select>
              </Field>
              <Field label="Direction" id="signal-direction">
                <select id="signal-direction" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.direction} onChange={updateField('direction')}>
                  <option value="long">Long</option><option value="short">Short</option>
                </select>
              </Field>
              <Field label="Order type" id="signal-order-type">
                <select id="signal-order-type" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.orderType} onChange={updateField('orderType')}>
                  <option value="market">Market</option><option value="limit">Limit</option>
                </select>
              </Field>
              <Field label="Entry time" id="signal-entry-time">
                <Input id="signal-entry-time" type="datetime-local" value={form.entryTime} onChange={updateField('entryTime')} />
              </Field>
              <Field label="Entry price (or provide a range)" id="signal-entry">
                <Input id="signal-entry" type="number" min="0" step="any" value={form.entry} onChange={updateField('entry')} placeholder="Optional" />
              </Field>
              <Field label="Entry range minimum" id="signal-entry-min">
                <Input id="signal-entry-min" type="number" min="0" step="any" value={form.entryMin} onChange={updateField('entryMin')} placeholder="Optional" />
              </Field>
              <Field label="Entry range maximum" id="signal-entry-max">
                <Input id="signal-entry-max" type="number" min="0" step="any" value={form.entryMax} onChange={updateField('entryMax')} placeholder="Optional" />
              </Field>
              <Field label="Stop loss" id="signal-stop">
                <Input id="signal-stop" type="number" min="0" step="any" value={form.stopLoss} onChange={updateField('stopLoss')} placeholder="Optional" />
              </Field>
              <Field label="Take-profit targets (comma separated)" id="signal-targets">
                <Input id="signal-targets" value={form.targets} onChange={updateField('targets')} placeholder="e.g. 68000, 69500" />
              </Field>
              <Field label="Leverage" id="signal-leverage">
                <Input id="signal-leverage" type="number" min="0" step="any" value={form.leverage} onChange={updateField('leverage')} placeholder="Optional" />
              </Field>
              <Field label="Valid until" id="signal-expiry">
                <Input id="signal-expiry" type="datetime-local" value={form.validUntil} onChange={updateField('validUntil')} />
              </Field>
              <Field label="Source evidence URL" id="signal-source">
                <Input id="signal-source" type="url" value={form.sourceEvidence} onChange={updateField('sourceEvidence')} placeholder="https://" />
              </Field>
            </div>
            <Field label="Notes and risk disclosures" id="signal-disclosures">
              <Textarea id="signal-disclosures" rows={4} maxLength={5000} value={form.disclosures} onChange={updateField('disclosures')} />
            </Field>
            <p className="text-xs text-muted-foreground">
              Enter either a single entry price or a complete entry range, not both.
            </p>
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

function Field({ label, id, children }) {
  return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
