import { Link } from 'react-router-dom';
import { AlertTriangle, CreditCard, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function PaymentHealthWidget({ data, isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No payment data available.</p>
        </CardContent>
      </Card>
    );
  }

  const successRate =
    data.successfulPayments && data.totalPayments
      ? data.successfulPayments / data.totalPayments
      : null;

  const metrics = [
    {
      label: 'Successful today',
      value: formatCurrency(data.successfulAmountToday ?? 0, data.currency ?? 'USD'),
      hint: `${data.successfulPaymentsToday ?? 0} payments`,
      icon: TrendingUp,
      tone: 'success',
    },
    {
      label: 'Failed today',
      value: formatCurrency(data.failedAmountToday ?? 0, data.currency ?? 'USD'),
      hint: `${data.failedPaymentsToday ?? 0} payments`,
      icon: TrendingDown,
      tone: data.failedPaymentsToday > 0 ? 'destructive' : 'default',
    },
    {
      label: 'Pending transactions',
      value: data.pendingTransactions ?? 0,
      icon: CreditCard,
    },
    {
      label: 'Unresolved disputes',
      value: data.unresolvedDisputes ?? 0,
      icon: AlertTriangle,
      tone: data.unresolvedDisputes > 0 ? 'warning' : 'default',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Payment health</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.console.payments.overview}>View payments</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label}>
                <p className="flex items-center gap-1 text-2xs uppercase tracking-wide text-muted-foreground">
                  {Icon ? <Icon className="h-3 w-3" /> : null}
                  {m.label}
                </p>
                <p
                  className={cn(
                    'mt-1 text-lg font-semibold',
                    m.tone === 'success' && 'text-success',
                    m.tone === 'warning' && 'text-warning',
                    m.tone === 'destructive' && 'text-destructive',
                    !m.tone && 'text-foreground',
                  )}
                >
                  {m.value}
                </p>
                {m.hint ? (
                  <p className="text-2xs text-muted-foreground">{m.hint}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {successRate !== null ? (
          <div className="border-t border-border pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Success rate</span>
              <span
                className={cn(
                  'font-medium',
                  successRate >= 0.95
                    ? 'text-success'
                    : successRate >= 0.85
                      ? 'text-warning'
                      : 'text-destructive',
                )}
              >
                {(successRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ) : null}

        {data.reconciliationDifferences > 0 ? (
          <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-2xs text-warning">
            {data.reconciliationDifferences} reconciliation difference
            {data.reconciliationDifferences !== 1 ? 's' : ''} need review.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}