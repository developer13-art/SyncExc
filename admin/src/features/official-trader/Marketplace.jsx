import { useState } from 'react';
import { Badge as StatusBadge } from '../../components/ui/Badge.jsx';
import { Pencil, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
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
  formatMoney,
  formatPrice,
  humanize,
  statusVariant,
} from './official-trader.utils.js';

function pricingLabel(pricing) {
  if (!pricing || typeof pricing !== 'object') return '—';
  if (pricing.amountMinor != null) {
    const amountMinor = Number(pricing.amountMinor);
    if (!amountMinor) return 'Free';
    return `${(amountMinor / 100).toFixed(2)} ${pricing.currency || ''} / ${humanize(pricing.billingInterval || '')}`.trim();
  }
  if (pricing.amount != null) {
    return `${formatMoney(pricing.amount)} ${pricing.currency || ''}`.trim();
  }
  if (pricing.price != null) {
    return `${formatMoney(pricing.price)} ${pricing.currency || ''}`.trim();
  }
  return Object.keys(pricing).length ? JSON.stringify(pricing) : 'Free';
}

const INITIAL_PLAN_FORM = {
  name: '',
  amount: '',
  currency: 'USD',
  billingInterval: 'monthly',
  reason: '',
};

export default function MarketplaceManagement() {
  useOfficialTraderPage('Marketplace management');
  const toast = useToast();
  const queryClient = useQueryClient();
  const stepUp = useStepUpAuth();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState(INITIAL_PLAN_FORM);
  const [formError, setFormError] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const marketplaceQuery = useQuery({
    queryKey: ['official-trader', 'marketplace'],
    queryFn: officialTraderApi.marketplace,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['official-trader'] });

  const savePlanMutation = useMutation({
    mutationFn: (payload) =>
      editingPlan
        ? officialTraderApi.updatePlan(editingPlan.id, payload)
        : officialTraderApi.createPlan(payload),
    onSuccess: (plan) => {
      toast.success(editingPlan ? 'Plan updated' : 'Plan created', {
        description: `${plan.name} — ${pricingLabel(plan.pricing)}`,
      });
      setEditorOpen(false);
      setEditingPlan(null);
      invalidate();
    },
    onError: (error) => toast.error('Plan could not be saved', { description: getErrorMessage(error) }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ planId, status, reason }) =>
      officialTraderApi.setPlanStatus(planId, { status, reason }),
    onSuccess: (plan) => {
      toast.success('Plan status updated', { description: `${plan.name} is now ${humanize(plan.status)}` });
      setStatusTarget(null);
      invalidate();
    },
    onError: (error) => toast.error('Plan status could not be changed', { description: getErrorMessage(error) }),
  });

  const openCreate = () => {
    setEditingPlan(null);
    setPlanForm(INITIAL_PLAN_FORM);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (row) => {
    setEditingPlan(row);
    setPlanForm({
      name: row.name ?? '',
      amount: row.pricing?.amountMinor != null ? (Number(row.pricing.amountMinor) / 100).toString() : '',
      currency: row.pricing?.currency ?? 'USD',
      billingInterval: row.pricing?.billingInterval ?? 'monthly',
      reason: '',
    });
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSavePlan = () => {
    const name = planForm.name.trim();
    const reason = planForm.reason.trim();
    if (name.length < 3) return setFormError('Plan name must be at least 3 characters.');
    const amount = Number(planForm.amount);
    if (!Number.isFinite(amount) || amount < 0) return setFormError('Enter a valid price. Use 0 for a free plan.');
    const amountMinor = Math.round(amount * 100);
    if (reason.length < 10) return setFormError('A reason of at least 10 characters is required.');
    setFormError(null);
    const payload = {
      name,
      pricing: {
        amountMinor,
        currency: planForm.currency,
        billingInterval: planForm.billingInterval,
      },
      ...(editingPlan ? {} : { entitlements: {} }),
      reason,
    };
    stepUp.requiresStepUp({
      reason: `${editingPlan ? 'Update' : 'Create'} official subscription plan "${name}": ${reason}`,
      run: () => savePlanMutation.mutateAsync(payload),
    });
  };

  const nextStatusAction = (row) => {
    if (row.status === 'draft' || row.status === 'retired') {
      return { status: 'active', label: 'Activate', variant: 'default' };
    }
    if (row.status === 'active') {
      return { status: 'retired', label: 'Retire', variant: 'destructive' };
    }
    return null;
  };

  if (marketplaceQuery.isLoading) {
    return <LoadingState label="Loading official marketplace presence" />;
  }
  if (marketplaceQuery.isError) {
    return (
      <ErrorState
        title="Marketplace data unavailable"
        description={getErrorMessage(marketplaceQuery.error)}
        onRetry={marketplaceQuery.refetch}
      />
    );
  }

  const data = marketplaceQuery.data;
  const provider = data?.provider;
  const summary = data?.summary ?? {};
  const plans = data?.plans ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marketplace management"
        description="The Official SyncExc AI Trader is a platform-owned provider. Its marketplace identity, plans, and published signals are managed here; performance comes from verified execution records."
      >
        <IconButton
          label="Refresh marketplace data"
          onClick={() => marketplaceQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw className={marketplaceQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {provider?.displayName || 'SyncExc Official AI Trader'}
            <StatusBadge variant="info">Official</StatusBadge>
          </p>
          <p className="text-xs text-muted-foreground">
            @{provider?.handle || 'syncexc-official'} · {humanize(provider?.visibility)} · {humanize(provider?.moderationState)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Published signals" value={summary.signals ?? 0} hint={`${summary.closed_signals ?? 0} closed`} />
        <StatCard label="Active subscribers" value={summary.active_subscriptions ?? 0} hint={`${summary.pending_subscriptions ?? 0} pending`} />
        <StatCard label="Active plans" value={summary.active_plans ?? 0} hint="Official marketplace plans" />
        <StatCard
          label="Copy executions"
          value={summary.copy_executions ?? 0}
          hint={`${summary.filled_copy_executions ?? 0} filled`}
        />
      </div>

      <Alert
        variant="info"
        title="Publication is execution-verified"
        description="Only analyses that passed validation, were accepted by an exchange, produced at least one confirmed fill, and reconciled with stop-loss and targets are published. Rejected, unfilled, failed, and research-only analyses never appear as successful trades."
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Subscription plans and fees</CardTitle>
            <CardDescription>
              Set the fee subscribers pay to follow the Official SyncExc AI Trader. Paid plans are billed through
              Flutterwave; activating a paid plan requires Flutterwave billing and webhooks to be configured.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Create plan
          </Button>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={[
              { key: 'name', label: 'Plan' },
              { key: 'pricing', label: 'Fee', render: (row) => pricingLabel(row.pricing) },
              {
                key: 'entitlements',
                label: 'Entitlements',
                render: (row) => (
                  <span className="text-xs text-muted-foreground">
                    {row.entitlements && Object.keys(row.entitlements).length
                      ? Object.entries(row.entitlements).map(([key, value]) => `${humanize(key)}: ${String(value)}`).join(', ')
                      : '—'}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge variant={statusVariant(row.status)}>{humanize(row.status)}</StatusBadge>,
              },
              { key: 'created_at', label: 'Created', render: (row) => formatDateTime(row.created_at) },
              {
                key: 'actions',
                label: 'Actions',
                align: 'right',
                render: (row) => {
                  const action = nextStatusAction(row);
                  return (
                    <div className="flex items-center justify-end gap-2">
                      {row.status !== 'archived' ? (
                        <IconButton label={`Edit ${row.name}`} onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                      ) : null}
                      {action ? (
                        <Button
                          size="sm"
                          variant={action.variant === 'destructive' ? 'outline' : 'default'}
                          onClick={() => setStatusTarget({ plan: row, status: action.status })}
                        >
                          {action.label}
                        </Button>
                      ) : null}
                    </div>
                  );
                },
              },
            ]}
            rows={plans}
            emptyTitle="No plans configured"
            emptyDescription="Create a subscription plan to let marketplace users pay for official access."
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Creating, editing, activating, or retiring a plan requires step-up verification and is recorded in the
            audit history. Changing a paid plan's fee detaches its stored payment-provider plan so the next checkout
            uses the new amount; existing subscribers keep their current billing.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published signals</CardTitle>
          <CardDescription>Recent verified publications linked to official executions.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={[
              {
                key: 'created_at',
                label: 'Published',
                render: (row) => (
                  <div>
                    <p className="text-sm text-foreground">{formatDateTime(row.created_at)}</p>
                    <p className="text-xs text-muted-foreground">{humanize(row.market_type)}</p>
                  </div>
                ),
              },
              {
                key: 'instrument',
                label: 'Signal',
                render: (row) => (
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.instrument}</p>
                    <p className="text-xs text-muted-foreground">{humanize(row.direction)} · entry {formatPrice(row.entry)}</p>
                  </div>
                ),
              },
              {
                key: 'levels',
                label: 'Levels',
                render: (row) => (
                  <span className="text-xs text-muted-foreground">
                    SL {formatPrice(row.stop_loss)}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge variant={statusVariant(row.status)}>{humanize(row.status)}</StatusBadge>,
              },
              {
                key: 'execution',
                label: 'Official execution',
                render: (row) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.execution_id ? row.execution_id.slice(0, 8) : '—'}
                  </span>
                ),
              },
              {
                key: 'realized_pnl',
                label: 'Realized PnL',
                align: 'right',
                render: (row) => (
                  <span className="text-xs">
                    {formatMoney(row.realized_pnl)} {row.pnl_asset || ''}
                  </span>
                ),
              },
            ]}
            rows={data?.signals?.items ?? []}
            emptyTitle="No published official signals"
            emptyDescription="Signals appear after a verified official execution is reconciled."
          />
        </CardContent>
      </Card>

      <Modal
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open && !savePlanMutation.isPending) {
            setEditorOpen(false);
            setEditingPlan(null);
          }
        }}
        title={editingPlan ? `Edit plan: ${editingPlan.name}` : 'Create official subscription plan'}
        description="Set the fee subscribers pay. A fee of 0 creates a free plan. Saving requires step-up verification."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditorOpen(false);
                setEditingPlan(null);
              }}
              disabled={savePlanMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePlan} disabled={savePlanMutation.isPending}>
              {savePlanMutation.isPending ? 'Saving…' : editingPlan ? 'Save changes' : 'Create plan'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Plan name
            <Input
              value={planForm.name}
              onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Official AI Trader — Monthly"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium">
              Fee (0 = free)
              <Input
                type="number"
                min="0"
                step="0.01"
                value={planForm.amount}
                onChange={(event) => setPlanForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="29.99"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Currency
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={planForm.currency}
                onChange={(event) => setPlanForm((current) => ({ ...current, currency: event.target.value }))}
              >
                <option value="USD">USD</option>
                <option value="NGN">NGN</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Billing interval
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={planForm.billingInterval}
                onChange={(event) => setPlanForm((current) => ({ ...current, billingInterval: event.target.value }))}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Reason
            <Input
              value={planForm.reason}
              onChange={(event) => setPlanForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Why is this fee being set or changed?"
            />
          </label>
          {formError ? <p className="text-xs text-destructive" role="alert">{formError}</p> : null}
          {editingPlan ? (
            <p className="text-xs text-muted-foreground">
              {editingPlan.status === 'active'
                ? 'This plan is active. Changing its fee detaches the stored payment-provider plan so the next checkout uses the new amount; existing subscribers keep their current billing.'
                : 'Changes apply to this draft plan. Activate it when you are ready to offer it to subscribers.'}
            </p>
          ) : null}
        </div>
      </Modal>

      <ReasonDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open && !statusMutation.isPending) setStatusTarget(null);
        }}
        title={statusTarget?.status === 'active' ? 'Activate plan' : 'Retire plan'}
        description={
          statusTarget?.status === 'active'
            ? 'Once active, marketplace users can subscribe to this plan at its current fee. Paid plans require Flutterwave billing to be configured.'
            : 'Retiring a plan hides it from new subscribers. Existing subscribers keep their current access and billing.'
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Activate' : 'Retire'}
        variant={statusTarget?.status === 'active' ? 'default' : 'destructive'}
        isLoading={statusMutation.isPending}
        onConfirm={(reason) => {
          stepUp.requiresStepUp({
            reason: `${statusTarget?.status === 'active' ? 'Activate' : 'Retire'} official subscription plan "${statusTarget?.plan?.name}": ${reason}`,
            run: () =>
              statusMutation.mutateAsync({
                planId: statusTarget.plan.id,
                status: statusTarget.status,
                reason,
              }),
          });
        }}
      />

      <StepUpGate stepUp={stepUp} />
    </div>
  );
}
