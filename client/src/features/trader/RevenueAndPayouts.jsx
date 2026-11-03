import { CircleDollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { marketplaceApi } from '../../api/index.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { getErrorMessage } from '../../api/errors.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export default function RevenueAndPayouts() {
  const { activeWorkspaceId } = useWorkspaceContext();
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Pending · {total.currency}
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatCurrency(total.pendingMinor / 100, total.currency)}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Paid: {formatCurrency(total.paidMinor / 100, total.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                SyncExc fee: {formatCurrency(total.platformFeeMinor / 100, total.currency)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

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
