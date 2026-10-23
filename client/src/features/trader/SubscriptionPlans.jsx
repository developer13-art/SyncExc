import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useToast } from '../../hooks/useToast.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { ROUTES } from '../../config/routes.config.js';

const plansKey = (workspaceId) => ['marketplace', 'my-provider-plans', workspaceId];

export default function SubscriptionPlans() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { activeWorkspaceId } = useWorkspaceContext();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ name: '', price: '0', features: '' });
  const plansQuery = useQuery({
    queryKey: plansKey(activeWorkspaceId),
    queryFn: () => marketplaceApi.getMyProviderPlans(),
  });
  const payoutQuery = useQuery({
    queryKey: ['marketplace', 'payout-account', activeWorkspaceId],
    queryFn: () => marketplaceApi.getPayoutAccountStatus(),
    enabled: Boolean(activeWorkspaceId),
  });
  const refreshPlans = () => queryClient.invalidateQueries({ queryKey: plansKey(activeWorkspaceId) });
  const createPlan = useMutation({
    mutationFn: (payload) => marketplaceApi.createMyProviderPlan(payload),
    onSuccess: async () => {
      await refreshPlans();
      setIsCreating(false);
      setForm({ name: '', price: '0', features: '' });
      toast.success('Subscription plan saved as a draft');
    },
  });
  const updatePlan = useMutation({
    mutationFn: ({ planId, status }) => marketplaceApi.updateMyProviderPlan(planId, { status }),
    onSuccess: async (_plan, variables) => {
      await refreshPlans();
      toast.success(variables.status === 'active' ? 'Free plan activated' : 'Plan retired');
    },
  });

  const handleCreate = (event) => {
    event.preventDefault();
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
      toast.error('Enter a valid monthly price between $0 and $1,000,000');
      return;
    }
    createPlan.mutate({
      name: form.name.trim(),
      pricing: {
        currency: 'USD',
        amountMinor: Math.round(price * 100),
        billingInterval: 'monthly',
      },
      entitlements: {
        features: [...new Set(form.features.split(',').map((item) => item.trim()).filter(Boolean))],
      },
    });
  };

  if (plansQuery.isLoading) return <LoadingState label="Loading subscription plans" />;
  if (plansQuery.isError) {
    return (
      <ErrorState
        title="Subscription plans unavailable"
        description={getErrorMessage(plansQuery.error)}
        onRetry={plansQuery.refetch}
      />
    );
  }

  const plans = plansQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Subscription plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define the tiers users can subscribe to for your signal content.</p>
        </div>
        <Button onClick={() => setIsCreating((current) => !current)}>
          <Plus className="h-4 w-4" /> {isCreating ? 'Close form' : 'Create plan'}
        </Button>
      </header>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {payoutQuery.isLoading
            ? 'Checking your Stripe payout setup. Free plans can be activated after your profile is approved and public.'
            : payoutQuery.isError
              ? 'Could not verify your Stripe payout setup. Free plans can still be activated; retry payout setup or check Revenue & payouts before activating a paid plan.'
              : payoutQuery.data?.status === 'ready'
                ? 'Stripe payouts are connected. Paid plan activation also requires marketplace billing and webhooks to be enabled by SyncExc.'
                : 'Paid plans need a connected Stripe payout account and SyncExc marketplace billing. Free plans can be activated after your profile is approved and public.'}
          {payoutQuery.data?.status !== 'ready' ? (
            <Button variant="link" className="ml-1 h-auto p-0" asChild>
              <Link to={ROUTES.app.trader.revenue}>Open Revenue & payouts</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {createPlan.isError || updatePlan.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {getErrorMessage(createPlan.error ?? updatePlan.error)}
        </p>
      ) : null}

      {isCreating ? (
        <Card>
          <CardHeader><CardTitle>Create a plan draft</CardTitle><CardDescription>Saved plans start as drafts and are not available for subscription until activated.</CardDescription></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleCreate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="provider-plan-name">Plan name</Label>
                  <Input id="provider-plan-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={100} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="provider-plan-price">Monthly price (USD)</Label>
                  <Input id="provider-plan-price" type="number" min="0" max="1000000" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="provider-plan-features">Included features (comma separated)</Label>
                <Input id="provider-plan-features" value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} placeholder="Signal updates, weekly analysis" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={createPlan.isPending}>{createPlan.isPending ? 'Saving…' : 'Save plan draft'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {plans.length === 0 ? (
        <EmptyState
          icon={Check}
          title="No plans created"
          description="Create a plan draft to start defining subscription tiers."
          action={<Button onClick={() => setIsCreating(true)}>Create your first plan</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const amountMinor = Number(plan.pricing?.amountMinor ?? 0);
            const isFree = amountMinor === 0;
            const payoutsReady = payoutQuery.data?.status === 'ready';
            const canActivate = plan.status === 'draft' && (isFree || payoutsReady);
            return (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{plan.name}</CardTitle>
                    <Badge variant={plan.status === 'active' ? 'success' : 'muted'}>{plan.status}</Badge>
                  </div>
                  <CardDescription>
                    {new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: plan.pricing?.currency ?? 'USD',
                    }).format(amountMinor / 100)} / month
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <ul className="grid gap-2 text-sm text-muted-foreground">
                    {(plan.entitlements?.features ?? []).map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-success" /> {feature}
                      </li>
                    ))}
                  </ul>
                  {canActivate ? (
                    <Button
                      variant="outline"
                      disabled={updatePlan.isPending}
                      onClick={() => updatePlan.mutate({ planId: plan.id, status: 'active' })}
                    >
                      Activate free plan
                    </Button>
                  ) : null}
                  {plan.status === 'active' ? (
                    <Button
                      variant="outline"
                      disabled={updatePlan.isPending}
                      onClick={() => updatePlan.mutate({ planId: plan.id, status: 'retired' })}
                    >
                      Retire plan
                    </Button>
                  ) : null}
                  {!isFree && plan.status === 'draft' ? (
                    payoutsReady ? (
                      <Button
                        variant="outline"
                        disabled={updatePlan.isPending}
                        onClick={() => updatePlan.mutate({ planId: plan.id, status: 'active' })}
                      >
                        Activate paid plan
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Connect Stripe payouts before activating this paid plan.
                      </p>
                    )
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
