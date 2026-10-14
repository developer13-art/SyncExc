import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { formatNumber } from '../../lib/formatters/number.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function SubscriptionHealthWidget({ data, isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No subscription data available.</p>
        </CardContent>
      </Card>
    );
  }

  const total =
    (data.active ?? 0) +
    (data.trialing ?? 0) +
    (data.pastDue ?? 0) +
    (data.cancelling ?? 0) +
    (data.expired ?? 0) +
    (data.suspended ?? 0);

  const rows = [
    { label: 'Active', value: data.active, variant: 'success' },
    { label: 'Trialing', value: data.trialing, variant: 'info' },
    { label: 'Past due', value: data.pastDue, variant: 'destructive' },
    { label: 'Cancelling', value: data.cancelling, variant: 'warning' },
    { label: 'Expired', value: data.expired, variant: 'muted' },
    { label: 'Suspended', value: data.suspended, variant: 'destructive' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Subscription health</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.console.subscriptions.overview}>View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">
            Total subscriptions
          </span>
          <span className="text-lg font-semibold text-foreground">
            {formatNumber(total, { maximumFractionDigits: 0 })}
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const percent = total > 0 ? (row.value / total) * 100 : 0;
            return (
              <li key={row.label} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 text-muted-foreground">{row.label}</span>
                <div className="flex-1">
                  <ProgressBar
                    value={percent}
                    indicatorClassName={
                      row.variant === 'success'
                        ? 'bg-success'
                        : row.variant === 'destructive'
                          ? 'bg-destructive'
                          : row.variant === 'warning'
                            ? 'bg-warning'
                            : row.variant === 'info'
                              ? 'bg-info'
                              : 'bg-muted-foreground'
                    }
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-medium text-foreground">
                  {formatNumber(row.value ?? 0, { maximumFractionDigits: 0 })}
                </span>
              </li>
            );
          })}
        </ul>

        {data.pastDue > 0 ? (
          <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-2xs text-warning">
            {data.pastDue} subscription{data.pastDue !== 1 ? 's are' : ' is'} past due. Consider
            reviewing payment retry policy or customer outreach.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}