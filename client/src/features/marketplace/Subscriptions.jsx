import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Subscriptions() {
  const dispatch = useDispatch();

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
                          subscription.status === 'active'
                            ? 'success'
                            : subscription.status === 'past_due'
                              ? 'destructive'
                              : 'muted'
                        }
                      >
                        {subscription.status ?? 'active'}
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
                        Renews {formatDate(subscription.currentPeriodEnd)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={ROUTES.app.marketplace.provider(subscription.providerId)}>
                        View provider
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}