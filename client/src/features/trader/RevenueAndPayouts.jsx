import { CircleDollarSign } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { marketplaceApi } from '../../api/index.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { getErrorMessage } from '../../api/errors.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { useToast } from '../../hooks/useToast.js';

export default function RevenueAndPayouts() {
  const { activeWorkspaceId } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [requestingCurrency, setRequestingCurrency] = useState(null);
  const earningsQuery = useQuery({
    queryKey: ['marketplace', 'earnings', activeWorkspaceId],
    queryFn: () => marketplaceApi.getMyEarnings(),
    enabled: Boolean(activeWorkspaceId),
  });

  if (earningsQuery.isLoading) return <LoadingState label="Loading marketplace earnings" />;
  if (earningsQuery.isError) {
    return (
      <ErrorState
        title="Marketplace earnings unavailable"
        description={getErrorMessage(earningsQuery.error)}
        onRetry={earningsQuery.refetch}
      />
    );
  }

  const totals = earningsQuery.data?.totals ?? [];
  const earnings = earningsQuery.data?.items ?? [];
  const payoutRequests = earningsQuery.data?.payoutRequests ?? [];
  const pendingRequestCurrencies = new Set(
    payoutRequests
      .filter((request) => request.status === 'pending')
      .map((request) => request.currency),
  );

  const handleRequestPayout = async (currency) => {
    setRequestingCurrency(currency);
    try {
      await marketplaceApi.requestMyPayout(currency);
      await queryClient.invalidateQueries({ queryKey: ['marketplace', 'earnings', activeWorkspaceId] });
      toast.success('Payout request submitted', {
        description: `Your available ${currency} balance has been sent to SyncExc for review.`,
      });
    } catch (error) {
      toast.error('Unable to request payout', { description: getErrorMessage(error) });
    } finally {
      setRequestingCurrency(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Revenue & payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Flutterwave processes subscriber payments. SyncExc records your share after payment
          confirmation, then an administrator manually pays it and records the transfer reference.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CircleDollarSign className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle>Manual Trader payouts</CardTitle>
              <CardDescription>
                Your balance is not paid automatically. Payout timing is managed by SyncExc.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          SyncExc’s platform fee is deducted from each confirmed subscription payment. Flutterwave
          processing fees and any payout costs may also apply outside this recorded share.
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Earnings totals">
        {totals.map((total) => (
          <Card key={total.currency}>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Available to request · {total.currency}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatCurrency((total.availableMinor ?? total.pendingMinor) / 100, total.currency)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Paid: {formatCurrency(total.paidMinor / 100, total.currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                In payout review: {formatCurrency((total.requestedMinor ?? 0) / 100, total.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                SyncExc fee: {formatCurrency(total.platformFeeMinor / 100, total.currency)}
              </p>
              <Button
                className="mt-4 w-full"
                size="sm"
                disabled={
                  !total.availableMinor ||
                  pendingRequestCurrencies.has(total.currency) ||
                  requestingCurrency === total.currency
                }
                onClick={() => handleRequestPayout(total.currency)}
              >
                {requestingCurrency === total.currency
                  ? 'Submitting…'
                  : pendingRequestCurrencies.has(total.currency)
                    ? 'Payout request pending'
                    : 'Request payout'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      {payoutRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Payout requests</CardTitle>
            <CardDescription>Track requests submitted to SyncExc for review.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {payoutRequests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-foreground">
                    {formatCurrency(Number(request.amount_minor) / 100, request.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(request.created_at)}</p>
                  {request.payout_reference ? (
                    <p className="mt-1 text-xs text-muted-foreground">Reference: {request.payout_reference}</p>
                  ) : null}
                </div>
                <Badge variant={request.status === 'paid' ? 'success' : request.status === 'pending' ? 'warning' : 'muted'}>
                  {request.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Payment and payout history</CardTitle>
          <CardDescription>
            Earnings are added only after Flutterwave payment verification. Paid records include the
            administrator-entered payout reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No confirmed marketplace payments yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-3 pr-4 font-medium">Date</th>
                    <th className="py-3 pr-4 font-medium">Payment</th>
                    <th className="py-3 pr-4 text-right font-medium">Gross</th>
                    <th className="py-3 pr-4 text-right font-medium">Your share</th>
                    <th className="py-3 pr-4 font-medium">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((earning) => (
                    <tr key={earning.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatRelativeTime(earning.created_at)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {earning.provider_payment_reference}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {formatCurrency(Number(earning.gross_amount_minor) / 100, earning.currency)}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium">
                        {formatCurrency(Number(earning.trader_net_amount_minor) / 100, earning.currency)}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={earning.status === 'paid' ? 'success' : 'warning'}>
                          {earning.status}
                        </Badge>
                        {earning.payout_reference ? (
                          <p className="mt-1 max-w-40 truncate text-xs text-muted-foreground">
                            Ref: {earning.payout_reference}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
