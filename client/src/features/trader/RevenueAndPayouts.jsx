import { CircleDollarSign } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { marketplaceApi } from '../../api/index.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { getErrorMessage } from '../../api/errors.js';

export default function RevenueAndPayouts() {
  const { activeWorkspaceId } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const [country, setCountry] = useState('');
  const payoutQuery = useQuery({
    queryKey: ['marketplace', 'payout-account', activeWorkspaceId],
    queryFn: () => marketplaceApi.getPayoutAccountStatus(),
    enabled: Boolean(activeWorkspaceId),
  });
  const onboarding = useMutation({
    mutationFn: () =>
      marketplaceApi.startPayoutAccountOnboarding(country || payoutQuery.data?.country),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ['marketplace', 'payout-account', activeWorkspaceId],
      });
      if (result.url) window.location.assign(result.url);
    },
  });
  const status = payoutQuery.data;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Revenue & payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect Stripe to receive subscription revenue for this Trader workspace.</p>
      </header>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CircleDollarSign className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle>
                {status?.status === 'ready' ? 'Stripe payouts are connected' : 'Set up Stripe payouts'}
              </CardTitle>
              <CardDescription>
                {status?.status === 'ready'
                  ? 'Stripe transfers subscription revenue to your connected account.'
                  : 'Complete Stripe Express onboarding before activating paid plans.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {payoutQuery.isError ? (
            <p className="mb-3 text-destructive" role="alert">
              {getErrorMessage(payoutQuery.error)}
            </p>
          ) : null}
          {onboarding.isError ? (
            <p className="mb-3 text-destructive" role="alert">
              {getErrorMessage(onboarding.error)}
            </p>
          ) : null}
          <p>
            SyncExc retains a {status?.platformFeePercent ?? 2}% platform fee on paid subscriptions. Stripe processes subscriber payments and transfers the remaining subscription revenue to your connected account. Payout timing and eligibility are controlled by Stripe.
          </p>
          {status?.status !== 'ready' ? (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              {!status?.country ? (
                <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
                  Stripe account country
                  <input
                    className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm uppercase"
                    value={country}
                    onChange={(event) => setCountry(event.target.value.slice(0, 2).toUpperCase())}
                    placeholder="US"
                    maxLength={2}
                    autoComplete="country"
                    aria-label="Stripe account country code"
                  />
                </label>
              ) : null}
              <Button
                disabled={onboarding.isPending || (!status?.country && country.length !== 2)}
                onClick={() => onboarding.mutate()}
              >
                {onboarding.isPending ? 'Connecting…' : 'Continue with Stripe'}
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span>Country: {status.country}</span>
              <Button
                variant="outline"
                disabled={onboarding.isPending}
                onClick={() => onboarding.mutate()}
              >
                Update Stripe details
              </Button>
            </div>
          )}
          {payoutQuery.isLoading ? (
            <p className="mt-3 text-xs">Loading payout account status…</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
