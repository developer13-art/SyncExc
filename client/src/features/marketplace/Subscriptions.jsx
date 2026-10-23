import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';

export default function Subscriptions() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelPending, setCancelPending] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Provider Subscriptions'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
        { label: 'Subscriptions', path: ROUTES.app.marketplace.subscriptions },
      ]),
    );
  }, [dispatch]);

  const subscriptionsQuery = useQuery({
    queryKey: queryKeys.marketplace.subscriptions({}),
    queryFn: () => marketplaceApi.listSubscriptions({}),
  });

  const subscriptions = subscriptionsQuery.data?.items ?? [];

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelPending(true);
    try {
      await marketplaceApi.cancelSubscription(cancelTarget.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.subscriptions({}) });
      toast.success(
        cancelTarget.price > 0
          ? 'Subscription will end after the current billing period'
          : 'Subscription canceled',
      );
      setCancelTarget(null);
    } catch (error) {
      toast.error('Cancellation failed', { description: getErrorMessage(error) });
    } finally {
      setCancelPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Provider Subscriptions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your active and historical provider subscriptions. Subscriptions grant content
            access — copying is configured separately.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.marketplace.browse}>Browse providers</Link>
        </Button>
      </div>

      {subscriptionsQuery.isLoading ? (
        <LoadingState label="Loading subscriptions" />
      ) : subscriptionsQuery.isError ? (
        <ErrorState
          title="Unable to load subscriptions"
          description="We could not fetch your subscriptions."
          onRetry={subscriptionsQuery.refetch}
        />
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No provider subscriptions"
          description="Subscribe to a provider to access their content."
          action={
            <Button asChild>
              <Link to={ROUTES.app.marketplace.browse}>Browse providers</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {subscriptions.map((subscription) => (
                <li
                  key={subscription.id}
                  className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {subscription.providerName ?? 'Provider'}
                      </p>
                      <Badge
                        variant={
                          subscription.status === 'active' && !subscription.cancelAtPeriodEnd
                            ? 'success'
                            : subscription.status === 'past_due'
                              ? 'destructive'
                              : subscription.cancelAtPeriodEnd || subscription.status === 'subscription_pending'
                                ? 'warning'
                              : 'muted'
                        }
                      >
                        {subscription.cancelAtPeriodEnd
                          ? 'cancels at period end'
                          : subscription.status ?? 'active'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {subscription.planName ?? 'Plan'}
                      {subscription.price !== undefined
                        ? ` · ${formatCurrency(subscription.price, subscription.currency ?? 'USD')} / ${subscription.billingInterval ?? 'month'}`
                        : ''}
                    </p>
                    {subscription.currentPeriodEnd ? (
                      <p className="mt-1 text-2xs text-muted-foreground">
                        {subscription.cancelAtPeriodEnd ? 'Access through ' : 'Renews '}
                        {formatDate(subscription.currentPeriodEnd)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {subscription.checkoutUrl ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={subscription.checkoutUrl}>Continue checkout</a>
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" asChild>
                      <Link to={ROUTES.app.marketplace.provider(subscription.providerId)}>
                        View provider
                      </Link>
                    </Button>
                    {['active', 'past_due'].includes(subscription.status) &&
                    !subscription.cancelAtPeriodEnd ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelTarget(subscription)}
                      >
                        {subscription.price > 0 ? 'Cancel renewal' : 'Cancel subscription'}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open && !cancelPending) setCancelTarget(null);
        }}
        title={cancelTarget?.price > 0 ? 'Cancel subscription renewal?' : 'Cancel subscription?'}
        description={
          cancelTarget?.price > 0 && cancelTarget.currentPeriodEnd
            ? `Your subscription will remain active until ${formatDate(cancelTarget.currentPeriodEnd)}, then will not renew.`
            : cancelTarget?.price > 0
              ? 'Your subscription will remain active through the paid period, then will not renew.'
              : 'Your subscription access will end immediately.'
        }
        confirmLabel="Confirm cancellation"
        variant="destructive"
        onConfirm={handleCancel}
        isLoading={cancelPending}
      />
    </div>
  );
}