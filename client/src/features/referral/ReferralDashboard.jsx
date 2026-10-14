import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Coins,
  Link2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useReferralProfile, useReferralDashboard, useReferralLinks } from '../../hooks/useReferrals.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function ReferralDashboard() {
  const dispatch = useDispatch();
  const profileQuery = useReferralProfile();
  const dashboardQuery = useReferralDashboard();
  const linksQuery = useReferralLinks({ limit: 3 });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Referral Program'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Referral', path: ROUTES.app.referral.dashboard },
      ]),
    );
  }, [dispatch]);

  const isLoading =
    profileQuery.isLoading || dashboardQuery.isLoading || linksQuery.isLoading;
  const isError = profileQuery.isError || dashboardQuery.isError;

  if (!profileQuery.isEnrolled && !profileQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Coins className="h-6 w-6" />
            </div>
            <div className="max-w-md">
              <h2 className="text-lg font-semibold text-foreground">
                Earn from qualifying subscription referrals
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Refer eligible users to SyncExc and earn a commission from their qualifying
                subscription payments. Rewards are never based on trading activity.
              </p>
            </div>
            <Button asChild>
              <Link to={ROUTES.app.referral.enroll}>Enroll in the program</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState label="Loading referral dashboard" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load dashboard"
        description="We could not fetch your referral data."
        onRetry={() => {
          dashboardQuery.refetch();
          linksQuery.refetch();
        }}
      />
    );
  }

  const dashboard = dashboardQuery.data ?? {};
  const links = linksQuery.links ?? [];
  const currency = dashboard.currency ?? 'USD';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Referral Program
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Earn commissions from qualifying subscription payments. Only direct referrals are
            rewarded — there is no multi-level structure.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.referral.links}>Manage links</Link>
          </Button>
          <Button asChild>
            <Link to={ROUTES.app.referral.createLink}>
              <Link2 className="h-4 w-4" /> New link
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Payable balance"
          value={formatCurrency(dashboard.payableBalance ?? 0, currency)}
          hint={
            dashboard.pendingBalance
              ? `${formatCurrency(dashboard.pendingBalance, currency)} pending`
              : 'Ready to withdraw'
          }
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Lifetime earnings"
          value={formatCurrency(dashboard.lifetimeEarnings ?? 0, currency)}
          hint={`Since ${dashboard.enrolledAt ? formatRelativeTime(dashboard.enrolledAt) : ''}`}
          icon={Coins}
        />
        <StatCard
          label="Referrals"
          value={dashboard.totalReferrals ?? 0}
          hint={`${dashboard.activeSubscriptions ?? 0} active subscriptions`}
          icon={Users}
        />
        <StatCard
          label="Conversion rate"
          value={
            dashboard.conversionRate !== undefined
              ? `${(dashboard.conversionRate * 100).toFixed(1)}%`
              : '—'
          }
          hint="Clicks → qualifying payments"
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent referral activity</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to={ROUTES.app.referral.commissions}>
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dashboard.recentActivity?.length > 0 ? (
              <ul className="divide-y divide-border">
                {dashboard.recentActivity.map((activity, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {activity.description ?? activity.type}
                      </p>
                      <p className="mt-0.5 text-2xs text-muted-foreground">
                        {activity.occurredAt ? formatRelativeTime(activity.occurredAt) : ''}
                      </p>
                    </div>
                    {activity.amount !== undefined ? (
                      <span className="shrink-0 text-sm font-semibold text-success">
                        +{formatCurrency(activity.amount, currency)}
                      </span>
                    ) : (
                      <Badge variant="muted">{activity.type}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Coins}
                title="No activity yet"
                description="Referral activity will appear here as it occurs."
                size="sm"
                className="border-0 bg-transparent py-8"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top links</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to={ROUTES.app.referral.links}>All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {links.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Link2}
                  title="No links yet"
                  description="Create a referral link to start sharing."
                  size="sm"
                  className="border-0 bg-transparent py-4"
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {links.map((link) => (
                  <li key={link.id} className="px-5 py-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {link.name ?? link.code}
                    </p>
                    <div className="mt-1 flex gap-3 text-2xs text-muted-foreground">
                      <span>{link.clicks ?? 0} clicks</span>
                      <span>{link.conversions ?? 0} conversions</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.referral.commissions}>Commissions</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.referral.ledger}>Ledger</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.referral.payouts}>Payouts</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.referral.statements}>Statements</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.referral.campaigns}>Campaigns</Link>
        </Button>
      </div>
    </div>
  );
}