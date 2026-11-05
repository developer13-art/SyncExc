import { useMemo, useState } from 'react';
import { Link2, Pencil, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
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
  humanize,
  statusVariant,
} from './official-trader.utils.js';

const ENVIRONMENTS = [
  { value: 'live', label: 'Live' },
  { value: 'testnet', label: 'Testnet' },
  { value: 'demo', label: 'Demo' },
];

const CONNECTION_STATUSES = ['active', 'paused', 'disconnected'];

const INITIAL_CONNECT = {
  exchange: '',
  environment: 'live',
  label: '',
  apiKey: '',
  apiSecret: '',
  passphrase: '',
  accountType: '',
  spot: true,
  futures: true,
  withdrawalConfirmed: false,
  reason: '',
};

const INITIAL_ASSIGN = {
  target: '',
  spot: true,
  futures: true,
  symbols: '',
  isDefault: false,
  maxOrderNotional: '',
  maxOpenPositions: '',
  maxDailyExposure: '',
  maxLeverage: '',
  maxDailyLoss: '',
  maxDrawdownPct: '',
  maxSlippageBps: '',
  reason: '',
};

const INITIAL_EDIT = {
  label: '',
  status: 'active',
  spot: true,
  futures: true,
  symbols: '',
  isDefault: false,
  maxOrderNotional: '',
  maxOpenPositions: '',
  maxDailyExposure: '',
  maxLeverage: '',
  maxDailyLoss: '',
  maxDrawdownPct: '',
  maxSlippageBps: '',
  reason: '',
};

function marketTypes(spot, futures) {
  return [
    ...(spot ? ['spot'] : []),
    ...(futures ? ['futures'] : []),
  ];
}

function splitSymbols(value) {
  return String(value || '')
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
}

function NumberOrUndefined(value) {
  if (value === '' || value == null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function limitsFrom(form) {
  const limits = {
    maxOrderNotional: NumberOrUndefined(form.maxOrderNotional),
    maxOpenPositions: NumberOrUndefined(form.maxOpenPositions),
    maxDailyExposure: NumberOrUndefined(form.maxDailyExposure),
    maxLeverage: NumberOrUndefined(form.maxLeverage),
    maxDailyLoss: NumberOrUndefined(form.maxDailyLoss),
    maxDrawdownPct: NumberOrUndefined(form.maxDrawdownPct),
    maxSlippageBps: NumberOrUndefined(form.maxSlippageBps),
  };
  return Object.fromEntries(Object.entries(limits).filter(([, value]) => value !== undefined));
}

export default function ExchangeAccounts() {
  useOfficialTraderPage('Official exchange accounts');
  const toast = useToast();
  const queryClient = useQueryClient();
  const stepUp = useStepUpAuth();

  const [connectOpen, setConnectOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [connectForm, setConnectForm] = useState(INITIAL_CONNECT);
  const [assignForm, setAssignForm] = useState(INITIAL_ASSIGN);
  const [editForm, setEditForm] = useState(INITIAL_EDIT);
  const [formError, setFormError] = useState(null);

  const connectionsQuery = useQuery({
    queryKey: ['official-trader', 'connections'],
    queryFn: officialTraderApi.connections,
  });
  const availableQuery = useQuery({
    queryKey: ['official-trader', 'available-connections'],
    queryFn: officialTraderApi.availableConnections,
  });
  const catalogQuery = useQuery({
    queryKey: ['official-trader', 'exchange-catalog'],
    queryFn: officialTraderApi.exchangeCatalog,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['official-trader'] });

  const connectMutation = useMutation({
    mutationFn: officialTraderApi.connectExchange,
    onSuccess: () => {
      setConnectOpen(false);
      setConnectForm(INITIAL_CONNECT);
      toast.success('Official exchange account connected');
      invalidate();
    },
    onError: (error) => toast.error('Connection failed', { description: getErrorMessage(error) }),
  });

  const assignMutation = useMutation({
    mutationFn: officialTraderApi.assignConnection,
    onSuccess: () => {
      setAssignOpen(false);
      setAssignForm(INITIAL_ASSIGN);
      toast.success('Existing exchange account assigned');
      invalidate();
    },
    onError: (error) => toast.error('Assignment failed', { description: getErrorMessage(error) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ assignmentId, payload }) =>
      officialTraderApi.updateConnection(assignmentId, payload),
    onSuccess: () => {
      setEditTarget(null);
      toast.success('Connection assignment updated');
      invalidate();
    },
    onError: (error) => toast.error('Update failed', { description: getErrorMessage(error) }),
  });

  const removeMutation = useMutation({
    mutationFn: ({ assignmentId, reason }) =>
      officialTraderApi.removeConnection(assignmentId, { reason }),
    onSuccess: () => {
      setRemoveTarget(null);
      toast.success('Connection assignment removed');
      invalidate();
    },
    onError: (error) => toast.error('Remove failed', { description: getErrorMessage(error) }),
  });

  const exchanges = catalogQuery.data?.exchanges ?? [];
  const available = useMemo(
    () => (availableQuery.data ?? []).filter((row) => !row.already_assigned),
    [availableQuery.data],
  );

  if (connectionsQuery.isLoading) {
    return <LoadingState label="Loading exchange accounts" />;
  }
  if (connectionsQuery.isError) {
    return (
      <ErrorState
        title="Exchange accounts unavailable"
        description={getErrorMessage(connectionsQuery.error)}
        onRetry={connectionsQuery.refetch}
      />
    );
  }

  const handleConnect = () => {
    const reason = connectForm.reason.trim();
    if (!connectForm.exchange) return setFormError('Select an exchange.');
    if (connectForm.label.trim().length < 3) return setFormError('A label of at least 3 characters is required.');
    if (connectForm.apiKey.trim().length < 8 || connectForm.apiSecret.trim().length < 8) {
      return setFormError('A valid API key and secret are required.');
    }
    if (!connectForm.withdrawalConfirmed) {
      return setFormError('Confirm that withdrawal permissions are disabled before connecting.');
    }
    if (reason.length < 10) return setFormError('A reason of at least 10 characters is required.');
    const allowed = marketTypes(connectForm.spot, connectForm.futures);
    if (allowed.length === 0) return setFormError('Select at least one market type.');
    setFormError(null);
    const payload = {
      exchange: connectForm.exchange,
      environment: connectForm.environment,
      label: connectForm.label.trim(),
      credentials: {
        apiKey: connectForm.apiKey.trim(),
        apiSecret: connectForm.apiSecret.trim(),
        ...(connectForm.passphrase.trim() ? { passphrase: connectForm.passphrase.trim() } : {}),
      },
      accountType: connectForm.accountType || undefined,
      allowedMarketTypes: allowed,
      makeDefault: true,
      reason,
    };
    stepUp.requiresStepUp({
      reason: `Connect official exchange account: ${reason}`,
      run: () => connectMutation.mutateAsync(payload),
    });
  };

  const openAssign = () => {
    setAssignForm(INITIAL_ASSIGN);
    setFormError(null);
    setAssignOpen(true);
  };

  const handleAssign = () => {
    const reason = assignForm.reason.trim();
    const [connectionId, accountId] = assignForm.target.split(':');
    if (!connectionId || !accountId) return setFormError('Select an available exchange account.');
    const allowed = marketTypes(assignForm.spot, assignForm.futures);
    if (allowed.length === 0) return setFormError('Select at least one market type.');
    if (reason.length < 10) return setFormError('A reason of at least 10 characters is required.');
    setFormError(null);
    const payload = {
      connectionId,
      accountId,
      isDefault: assignForm.isDefault,
      allowedMarketTypes: allowed,
      allowedSymbols: splitSymbols(assignForm.symbols),
      limits: limitsFrom(assignForm),
      reason,
    };
    stepUp.requiresStepUp({
      reason: `Assign official exchange account: ${reason}`,
      run: () => assignMutation.mutateAsync(payload),
    });
  };

  const openEdit = (row) => {
    setEditTarget(row);
    setFormError(null);
    setEditForm({
      label: row.label ?? '',
      status: row.status ?? 'active',
      spot: (row.allowedMarketTypes ?? []).includes('spot'),
      futures: (row.allowedMarketTypes ?? []).includes('futures'),
      symbols: (row.allowedSymbols ?? []).join(', '),
      isDefault: Boolean(row.isDefault),
      maxOrderNotional: row.limits?.maxOrderNotional ?? '',
      maxOpenPositions: row.limits?.maxOpenPositions ?? '',
      maxDailyExposure: row.limits?.maxDailyExposure ?? '',
      maxLeverage: row.limits?.maxLeverage ?? '',
      maxDailyLoss: row.limits?.maxDailyLoss ?? '',
      maxDrawdownPct: row.limits?.maxDrawdownPct ?? '',
      maxSlippageBps: row.limits?.maxSlippageBps ?? '',
      reason: '',
    });
  };

  const handleEdit = () => {
    if (!editTarget) return;
    const reason = editForm.reason.trim();
    if (reason.length < 10) return setFormError('A reason of at least 10 characters is required.');
    const allowed = marketTypes(editForm.spot, editForm.futures);
    if (allowed.length === 0) return setFormError('Select at least one market type.');
    setFormError(null);
    updateMutation.mutate({
      assignmentId: editTarget.id,
      payload: {
        fields: {
          label: editForm.label.trim(),
          status: editForm.status,
          allowedMarketTypes: allowed,
          allowedSymbols: splitSymbols(editForm.symbols),
          isDefault: editForm.isDefault,
          ...limitsFrom(editForm),
        },
        reason,
      },
    });
  };

  const columns = [
    {
      key: 'label',
      label: 'Account',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-foreground">{row.label || '—'}</p>
          <p className="text-xs text-muted-foreground">
            {row.exchangeCode} · {humanize(row.accountType)} · {humanize(row.environment)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge>
          {row.isDefault ? <Badge variant="info">Default</Badge> : null}
        </div>
      ),
    },
    {
      key: 'markets',
      label: 'Markets',
      render: (row) => (
        <div>
          <p className="text-sm">{formatList(row.allowedMarketTypes)}</p>
          <p className="text-xs text-muted-foreground">
            {row.allowedSymbols?.length ? row.allowedSymbols.join(', ') : 'All instruments'}
          </p>
        </div>
      ),
    },
    {
      key: 'limits',
      label: 'Risk limits',
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          <p>Order notional: {row.limits?.maxOrderNotional == null ? 'platform default' : formatMoney(row.limits.maxOrderNotional)}</p>
          <p>Open positions: {row.limits?.maxOpenPositions ?? 'platform default'}</p>
          <p>Leverage: {row.limits?.maxLeverage ?? 'platform default'}</p>
        </div>
      ),
    },
    {
      key: 'connection',
      label: 'Connection',
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          <p>Connection: {humanize(row.connectionStatus)}</p>
          <p>Account: {humanize(row.accountStatus)}</p>
          <p>Added {formatDateTime(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Edit assignment" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label="Remove assignment" onClick={() => setRemoveTarget(row)}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      ),
    },
  ];

  const connectionFields = (form, setForm, { showIdentity = true } = {}) => (
    <>
      {showIdentity ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Label
            <Input
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Status
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            >
              {CONNECTION_STATUSES.map((status) => (
                <option key={status} value={status}>{humanize(status)}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.spot}
            onChange={(event) => setForm((current) => ({ ...current, spot: event.target.checked }))}
          />
          Spot
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.futures}
            onChange={(event) => setForm((current) => ({ ...current, futures: event.target.checked }))}
          />
          Futures
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
          />
          Default account
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Allowed symbols
        <Input
          value={form.symbols}
          onChange={(event) => setForm((current) => ({ ...current, symbols: event.target.value }))}
          placeholder="BTCUSDT, ETHUSDT — leave blank for all"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['maxOrderNotional', 'Max order notional'],
          ['maxOpenPositions', 'Max open positions'],
          ['maxDailyExposure', 'Max daily exposure'],
          ['maxLeverage', 'Max leverage'],
          ['maxDailyLoss', 'Max daily loss'],
          ['maxDrawdownPct', 'Max drawdown %'],
          ['maxSlippageBps', 'Max slippage (bps)'],
        ].map(([key, label]) => (
          <label key={key} className="grid gap-1 text-sm font-medium">
            {label}
            <Input
              type="number"
              min="0"
              step="any"
              value={form[key]}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              placeholder="Platform default"
            />
          </label>
        ))}
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Reason
        <Textarea
          rows={3}
          value={form.reason}
          onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
          placeholder="Explain this change for the audit trail"
        />
      </label>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exchange accounts"
        description="Connect and manage the company exchange accounts used for official execution. Credentials are encrypted, masked, and never displayed. Withdrawal permissions must never be enabled."
      >
        <IconButton
          label="Refresh exchange accounts"
          onClick={() => {
            connectionsQuery.refetch();
            availableQuery.refetch();
            catalogQuery.refetch();
          }}
          className="border border-border"
        >
          <RefreshCw className={connectionsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
        <Button variant="outline" onClick={openAssign} disabled={available.length === 0}>
          <Link2 className="h-4 w-4" /> Assign existing
        </Button>
        <Button onClick={() => { setConnectForm(INITIAL_CONNECT); setFormError(null); setConnectOpen(true); }}>
          <Plus className="h-4 w-4" /> Connect exchange
        </Button>
      </PageHeader>

      <Alert
        variant="warning"
        title="Least-privilege exchange keys"
        description="Only enable read and trade permissions. Withdrawal permissions must never be enabled. Administrators never see the stored API secret after submission."
      />

      <Card>
        <CardHeader>
          <CardTitle>Assigned official accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={columns}
            rows={connectionsQuery.data ?? []}
            emptyTitle="No official exchange accounts"
            emptyDescription="Connect a company exchange account or assign an existing workspace connection."
            emptyAction={
              <Button onClick={() => setConnectOpen(true)}>
                <Plus className="h-4 w-4" /> Connect exchange
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Modal
        open={connectOpen}
        onOpenChange={(open) => {
          if (!connectMutation.isPending) setConnectOpen(open);
        }}
        title="Connect official exchange account"
        description="The connection is created through the encrypted connections service. Credentials are validated before any official execution is allowed."
        footer={
          <>
            <Button variant="outline" onClick={() => setConnectOpen(false)} disabled={connectMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? 'Connecting…' : 'Connect account'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Exchange
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={connectForm.exchange}
                onChange={(event) => setConnectForm((current) => ({ ...current, exchange: event.target.value }))}
              >
                <option value="">Select an exchange</option>
                {exchanges.map((exchange) => (
                  <option key={exchange.exchange_code} value={exchange.exchange_code}>
                    {exchange.display_name || exchange.exchange_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Environment
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={connectForm.environment}
                onChange={(event) => setConnectForm((current) => ({ ...current, environment: event.target.value }))}
              >
                {ENVIRONMENTS.map((environment) => (
                  <option key={environment.value} value={environment.value}>{environment.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Label
              <Input
                value={connectForm.label}
                onChange={(event) => setConnectForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Official execution account"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Account type
              <Input
                value={connectForm.accountType}
                onChange={(event) => setConnectForm((current) => ({ ...current, accountType: event.target.value }))}
                placeholder="e.g. unified, spot"
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium">
            API key
            <Input
              autoComplete="off"
              value={connectForm.apiKey}
              onChange={(event) => setConnectForm((current) => ({ ...current, apiKey: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            API secret
            <Input
              type="password"
              autoComplete="new-password"
              value={connectForm.apiSecret}
              onChange={(event) => setConnectForm((current) => ({ ...current, apiSecret: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Passphrase (if required)
            <Input
              type="password"
              autoComplete="new-password"
              value={connectForm.passphrase}
              onChange={(event) => setConnectForm((current) => ({ ...current, passphrase: event.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={connectForm.spot}
                onChange={(event) => setConnectForm((current) => ({ ...current, spot: event.target.checked }))}
              />
              Spot
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={connectForm.futures}
                onChange={(event) => setConnectForm((current) => ({ ...current, futures: event.target.checked }))}
              />
              Futures
            </label>
          </div>
          <label className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={connectForm.withdrawalConfirmed}
              onChange={(event) => setConnectForm((current) => ({ ...current, withdrawalConfirmed: event.target.checked }))}
            />
            <span className="flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-warning" />
              I confirm withdrawal permissions are disabled and this key has only read and trade access.
            </span>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Reason
            <Textarea
              rows={3}
              value={connectForm.reason}
              onChange={(event) => setConnectForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Explain why this account is being connected"
            />
          </label>
          {formError ? <p className="text-xs text-destructive" role="alert">{formError}</p> : null}
          <p className="text-xs text-muted-foreground">
            Connecting an official exchange account is a sensitive action and requires step-up verification.
            It is audited and never exposes secrets in the UI or logs.
          </p>
        </div>
      </Modal>

      <Modal
        open={assignOpen}
        onOpenChange={(open) => {
          if (!assignMutation.isPending) setAssignOpen(open);
        }}
        title="Assign an existing exchange account"
        description="Only active accounts that are not already assigned appear here. Risk limits scoped to this assignment protect official execution from subscriber-level changes."
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assignMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assignMutation.isPending}>
              {assignMutation.isPending ? 'Assigning…' : 'Assign account'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Available account
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={assignForm.target}
              onChange={(event) => setAssignForm((current) => ({ ...current, target: event.target.value }))}
            >
              <option value="">Select an account</option>
              {available.map((row) => (
                <option key={`${row.connection_id}:${row.account_id}`} value={`${row.connection_id}:${row.account_id}`}>
                  {row.label || row.exchange_code} · {humanize(row.exchange_code)} · {humanize(row.account_type)} · {humanize(row.environment)}
                </option>
              ))}
            </select>
          </label>
          {connectionFields(assignForm, setAssignForm, { showIdentity: false })}
          {formError ? <p className="text-xs text-destructive" role="alert">{formError}</p> : null}
          <p className="text-xs text-muted-foreground">
            Assigning an official account is a sensitive action and requires step-up verification.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open && !updateMutation.isPending) setEditTarget(null);
        }}
        title={`Edit ${editTarget?.label ?? 'connection'}`}
        description="Changes apply only to the official trader assignment. They never modify user workspace configuration."
        footer={
          <>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {connectionFields(editForm, setEditForm)}
          {formError ? <p className="text-xs text-destructive" role="alert">{formError}</p> : null}
        </div>
      </Modal>

      <ReasonDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open && !removeMutation.isPending) setRemoveTarget(null);
        }}
        title="Remove official connection assignment"
        description="Only the assignment is removed. Removing it does not cancel orders already accepted by the exchange or close open positions. Open official executions must be reconciled first."
        confirmLabel="Remove assignment"
        variant="destructive"
        isLoading={removeMutation.isPending}
        onConfirm={(reason) => {
          stepUp.requiresStepUp({
            reason: `Remove official connection: ${reason}`,
            run: () => removeMutation.mutateAsync({ assignmentId: removeTarget.id, reason }),
          });
        }}
      />

      <StepUpGate stepUp={stepUp} />
    </div>
  );
}
