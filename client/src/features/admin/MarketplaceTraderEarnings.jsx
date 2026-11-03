import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

const earningsKey = ['admin', 'marketplace-trader-earnings'];

export default function MarketplaceTraderEarnings() {
  const queryClient = useQueryClient();
  const [references, setReferences] = useState({});
  const earningsQuery = useQuery({
    queryKey: earningsKey,
    queryFn: () => adminApi.listMarketplaceTraderEarnings({ limit: 100 }),
  });
  const markPaid = useMutation({
    mutationFn: ({ earningId, payoutReference }) =>
      adminApi.markMarketplaceTraderEarningPaid(earningId, { payoutReference }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: earningsKey }),
  });

  if (earningsQuery.isLoading) return <LoadingState label="Loading Trader earnings" />;
  if (earningsQuery.isError) {
    return (
      <ErrorState
        title="Trader earnings unavailable"
        description={getErrorMessage(earningsQuery.error)}
        onRetry={earningsQuery.refetch}
      />
    );
  }

  const rows = earningsQuery.data ?? [];
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Marketplace Trader earnings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record the payout only after the external bank transfer is completed. This action is
          audited and requires step-up authentication.
        </p>
      </header>

      {markPaid.isError ? (
        <p className="text-sm text-destructive" role="alert">{getErrorMessage(markPaid.error)}</p>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No marketplace earnings are recorded yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((earning) => (
            <Card key={earning.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{earning.provider_name} (@{earning.provider_handle})</CardTitle>
                    <CardDescription>
                      {earning.trader_email} · {formatRelativeTime(earning.created_at)}
                    </CardDescription>
                  </div>
                  <Badge variant={earning.status === 'paid' ? 'success' : 'warning'}>
                    {earning.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-4">
                <p className="text-sm">
                  Gross: {formatCurrency(Number(earning.gross_amount_minor) / 100, earning.currency)}
                </p>
                <p className="text-sm">
                  Platform fee: {formatCurrency(Number(earning.platform_fee_minor) / 100, earning.currency)}
                </p>
                <p className="text-sm font-medium">
                  Trader share: {formatCurrency(Number(earning.trader_net_amount_minor) / 100, earning.currency)}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  Flutterwave ref: {earning.provider_payment_reference}
                </p>
                {earning.status === 'pending' ? (
                  <div className="flex gap-2 sm:col-span-4">
                    <Input
                      aria-label={`Payout reference for ${earning.provider_name}`}
                      placeholder="External transfer reference"
                      value={references[earning.id] ?? ''}
                      onChange={(event) => setReferences({
                        ...references,
                        [earning.id]: event.target.value,
                      })}
                    />
                    <Button
                      disabled={markPaid.isPending || !references[earning.id]?.trim()}
                      onClick={() => markPaid.mutate({
                        earningId: earning.id,
                        payoutReference: references[earning.id].trim(),
                      })}
                    >
                      Record paid
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground sm:col-span-4">
                    Payout reference: {earning.payout_reference || 'Not recorded'}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
