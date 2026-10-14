import { Link } from 'react-router-dom';
import { ExternalLink, Users, Wallet } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function ReferralSummaryWidget({ dashboard, isLoading }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Referral Earnings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!dashboard) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Referral Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Enroll in the referral program to earn commissions from qualifying subscription
            payments.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to={ROUTES.app.referral.enroll}>Learn more</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Referral Earnings</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.app.referral.dashboard}>
              Details <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5 pt-0">
        <div>
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">Payable</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {formatCurrency(dashboard.payableBalance ?? 0, dashboard.currency ?? 'USD')}
          </p>
          {dashboard.pendingBalance ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatCurrency(dashboard.pendingBalance, dashboard.currency ?? 'USD')} pending
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                Referrals
              </p>
              <p className="text-sm font-medium text-foreground">
                {dashboard.totalReferrals ?? 0}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                Lifetime
              </p>
              <p className="text-sm font-medium text-foreground">
                {formatCurrency(
                  dashboard.lifetimeEarnings ?? 0,
                  dashboard.currency ?? 'USD',
                )}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}