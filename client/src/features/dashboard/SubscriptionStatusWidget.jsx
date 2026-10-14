import { Link } from 'react-router-dom';
import { CreditCard, ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { SubscriptionStatusBadge } from '../../components/domain/subscription/SubscriptionStatusBadge.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function SubscriptionStatusWidget({ subscription, usage, isLoading }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active subscription on this workspace.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to={ROUTES.app.billing.plans}>View plans</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const topUsage = usage?.metrics?.slice(0, 3) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>Subscription</CardTitle>
          <SubscriptionStatusBadge status={subscription.status} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5 pt-0">
        <div>
          <p className="text-sm font-medium text-foreground">{subscription.planName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subscription.price !== undefined
              ? `${formatCurrency(subscription.price, subscription.currency)} / ${subscription.billingInterval ?? 'month'}`
              : ''}
          </p>
        </div>

        {subscription.currentPeriodEnd ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            Renews {formatDate(subscription.currentPeriodEnd)}
          </div>
        ) : null}

        {topUsage.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            {topUsage.map((metric) => {
              const percent =
                metric.limit > 0 ? Math.min(100, (metric.used / metric.limit) * 100) : 0;
              return (
                <div key={metric.key}>
                  <div className="mb-1 flex items-center justify-between text-2xs">
                    <span className="text-muted-foreground">{metric.label}</span>
                    <span className="text-foreground">
                      {metric.used} / {metric.limit}
                    </span>
                  </div>
                  <ProgressBar
                    value={percent}
                    indicatorClassName={
                      percent >= 90
                        ? 'bg-destructive'
                        : percent >= 75
                          ? 'bg-warning'
                          : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to={ROUTES.app.billing.overview}>
            Manage billing <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}