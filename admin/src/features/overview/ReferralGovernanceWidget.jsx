import { Link } from 'react-router-dom';
import { Coins, AlertTriangle, Users, Wallet } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatNumber } from '../../lib/formatters/number.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function ReferralGovernanceWidget({ data, isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Referral governance</CardTitle>
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
          <CardTitle>Referral governance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No referral data available.</p>
        </CardContent>
      </Card>
    );
  }

  const currency = data.currency ?? 'USD';

  const metrics = [
    {
      icon: Users,
      label: 'Active affiliates',
      value: formatNumber(data.activeAffiliates ?? 0, { maximumFractionDigits: 0 }),
    },
    {
      icon: Coins,
      label: 'Commissions on hold',
      value: formatCurrency(data.commissionsOnHold ?? 0, currency),
      tone: data.commissionsOnHold > 0 ? 'warning' : undefined,
    },
    {
      icon: Wallet,
      label: 'Payouts pending approval',
      value: formatNumber(data.payoutsPendingApproval ?? 0, {
        maximumFractionDigits: 0,
      }),
      tone: data.payoutsPendingApproval > 0 ? 'warning' : undefined,
    },
    {
      icon: AlertTriangle,
      label: 'Open fraud cases',
      value: formatNumber(data.openFraudCases ?? 0, { maximumFractionDigits: 0 }),
      tone: data.openFraudCases > 0 ? 'destructive' : undefined,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Referral governance</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.console.referrals.overview}>Open</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <li
                key={metric.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      metric.tone === 'warning' && 'text-warning',
                      metric.tone === 'destructive' && 'text-destructive',
                    )}
                  />
                  <span className="truncate">{metric.label}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 font-medium',
                    metric.tone === 'warning' && 'text-warning',
                    metric.tone === 'destructive' && 'text-destructive',
                    !metric.tone && 'text-foreground',
                  )}
                >
                  {metric.value}
                </span>
              </li>
            );
          })}
        </ul>

        {data.policiesAwaitingApproval > 0 ? (
          <p className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-2xs text-info">
            {data.policiesAwaitingApproval} referral policy change
            {data.policiesAwaitingApproval !== 1 ? 's' : ''} awaiting approval.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}