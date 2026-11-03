import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, CircleDollarSign, Layers3, Search, Send, UserRound, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ProviderPerformance } from '../marketplace/ProviderPerformance.jsx';

const TABS = [
  ['overview', 'Overview'],
  ['signals', 'Published signals'],
  ['subscribers', 'Subscribers'],
  ['analytics', 'Analytics'],
  ['payouts', 'Payouts'],
  ['settings', 'Settings'],
];

export default function ProviderDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const { activeWorkspace, activeWorkspaceId } = useWorkspaceContext();
  const dashboardQuery = useQuery({
    queryKey: ['marketplace', 'provider-dashboard', activeWorkspaceId],
    queryFn: () => marketplaceApi.getProviderDashboard(),
    enabled: activeWorkspace?.type === 'trader',
  });
  const signalsQuery = useQuery({
    queryKey: ['marketplace', 'my-signals', activeWorkspaceId],
    queryFn: () => marketplaceApi.listMySignals({ limit: 50 }),
    enabled: activeWorkspace?.type === 'trader' && Boolean(dashboardQuery.data?.provider),
    staleTime: 30_000,
  });
  const subscribersQuery = useQuery({
    queryKey: ['marketplace', 'my-subscribers', activeWorkspaceId],
    queryFn: () => marketplaceApi.getMySubscribers({ limit: 50 }),
    enabled: activeWorkspace?.type === 'trader'
      && Boolean(dashboardQuery.data?.provider)
      && ['overview', 'subscribers'].includes(activeTab),
    staleTime: 30_000,
  });
  const payoutQuery = useQuery({
    queryKey: ['marketplace', 'earnings', activeWorkspaceId],
    queryFn: () => marketplaceApi.getMyEarnings(),
    enabled: activeWorkspace?.type === 'trader'
      && Boolean(dashboardQuery.data?.provider)
      && activeTab === 'payouts',
    staleTime: 30_000,
  });

  if (dashboardQuery.isLoading) return <LoadingState label="Loading My Marketplace" />;
  if (dashboardQuery.isError) {
    return (
      <ErrorState
        title="My Marketplace is unavailable"
        description={getErrorMessage(dashboardQuery.error)}
        onRetry={dashboardQuery.refetch}
      />
    );
  }

  const dashboard = dashboardQuery.data;
  if (!dashboard?.provider) {
    return (
      <EmptyState
        icon={UserRound}
        title="Set up your Trader profile"
        description="Create a Trader profile for this workspace before publishing signals or managing subscribers."
        action={
          <Button asChild>
            <Link to={ROUTES.app.trader.profile}>Create Trader profile</Link>
          </Button>
        }
      />
    );
  }

  const stats = dashboard.stats ?? {};
  const signals = signalsQuery.data?.items ?? dashboard.recentSignals ?? [];
  const pendingEarnings = payoutQuery.data?.totals?.length
    ? payoutQuery.data.totals
      .map((total) => formatCurrency(total.pendingMinor / 100, total.currency))
      .join(', ')
    : 'No pending earnings';
  const subscribers = subscribersQuery.data?.items ?? [];
  const publishedSignals = signals.map((signal) => ({
      id: signal.id,
      name: `${signal.instrument} · ${signal.direction}`,
      copyCount: Number(signal.copyCount || 0),
      status: signal.status,
      updatedAt: signal.updatedAt || signal.entryTime,
      href: ROUTES.app.trader.signalHistory,
    }));
  const filteredSignals = publishedSignals.filter((signal) =>
    `${signal.name} ${signal.status}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const totalSignals = Number(stats.total_signals ?? signals.length);
  const activeSignals = Number(stats.active_signals ?? signals.filter(isActiveSignal).length);
  const totalEarnings = stats.total_earnings ?? stats.totalEarnings;
  const earningsAmount = Number(totalEarnings);
  const hasEarnings = totalEarnings != null && Number.isFinite(earningsAmount);
  const metrics = [
    {
      label: 'Total earnings',
      value: !hasEarnings
        ? '—'
        : formatCurrency(earningsAmount, stats.earnings_currency || 'USD'),
      detail: hasEarnings ? 'Paid subscription revenue' : 'Payment history is not available yet',
      icon: CircleDollarSign,
    },
    {
      label: 'Active subscribers',
      value: Number(stats.active_subscribers || 0).toLocaleString(),
      detail: 'Current paid and free subscriptions',
      icon: Users,
    },
    {
      label: 'Total followers',
      value: Number(stats.total_followers || 0).toLocaleString(),
      detail: 'Following your Trader profile',
      icon: UserRound,
    },
    {
      label: 'Active signals',
      value: `${activeSignals.toLocaleString()} / ${totalSignals.toLocaleString()}`,
      detail: 'Published signals',
      icon: Send,
    },
  ];
  const recentActivity = [
    ...signals.map((signal) => ({
      id: `signal-${signal.id}`,
      title: 'Signal published',
      detail: `${signal.instrument} · ${signal.direction}`,
      date: signal.updatedAt || signal.entryTime,
      icon: Send,
    })),
    ...subscribers.map((subscriber) => ({
      id: `subscriber-${subscriber.id}`,
      title: 'New subscriber',
      detail: `${subscriber.displayName || subscriber.username} · ${subscriber.planName}`,
      date: subscriber.createdAt,
      icon: Users,
    })),
  ].filter((item) => item.date)
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, 5);
  const signalsError = signalsQuery.error;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Trader workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">My Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your published signals, track performance, and grow your audience.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 sm:w-72">
            <span className="sr-only">Search published signals</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search published signals"
              className="pl-9"
            />
          </label>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex min-w-0 items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-2 truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{value}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{detail}</p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <nav aria-label="My Marketplace sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            aria-current={activeTab === tab ? 'page' : undefined}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
          <SignalsCard
            signals={filteredSignals.slice(0, 5)}
            isLoading={signalsQuery.isLoading}
            error={signalsError}
            onRetry={() => {
              signalsQuery.refetch();
            }}
            onViewAll={() => setActiveTab('signals')}
          />
          <RecentActivity
            items={recentActivity}
            isLoading={subscribersQuery.isLoading || signalsQuery.isLoading}
          />
        </div>
      ) : null}

      {activeTab === 'signals' ? (
        <SignalsCard
          signals={filteredSignals}
          isLoading={signalsQuery.isLoading}
          error={signalsError}
          onRetry={() => {
            signalsQuery.refetch();
          }}
          onViewAll={() => setSearch('')}
          showAll
        />
      ) : null}

      {activeTab === 'subscribers' ? (
        <Card>
          <CardHeader>
            <CardTitle>Subscribers</CardTitle>
            <CardDescription>People subscribed to your Marketplace plans.</CardDescription>
          </CardHeader>
          <CardContent>
            {subscribersQuery.isLoading ? <LoadingState label="Loading subscribers" /> : null}
            {subscribersQuery.isError ? (
              <ErrorState
                title="Subscribers unavailable"
                description={getErrorMessage(subscribersQuery.error)}
                onRetry={subscribersQuery.refetch}
              />
            ) : null}
            {!subscribersQuery.isLoading && !subscribersQuery.isError && subscribers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No subscribers yet"
                description="Subscribers will appear here when someone joins one of your plans."
                size="sm"
                className="border-0 bg-transparent py-6"
              />
            ) : null}
            {subscribers.length > 0 ? (
              <div className="divide-y divide-border">
                {subscribers.map((subscriber) => (
                  <div key={subscriber.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{subscriber.displayName || subscriber.username}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{subscriber.planName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={subscriber.status === 'active' ? 'success' : 'muted'}>{subscriber.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {subscriber.createdAt ? formatRelativeTime(subscriber.createdAt) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'analytics' ? (
        <Card>
          <CardHeader>
            <CardTitle>Performance analytics</CardTitle>
            <CardDescription>Performance metrics calculated from linked closed trades.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProviderPerformance providerId={dashboard.provider.id} />
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'payouts' ? (
        <Card>
          <CardHeader>
            <CardTitle>Payouts</CardTitle>
            <CardDescription>Check your payout status and manage Stripe onboarding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {payoutQuery.isLoading ? <LoadingState label="Loading payout status" /> : null}
            {payoutQuery.isError ? (
              <ErrorState
                title="Payout status unavailable"
                description={getErrorMessage(payoutQuery.error)}
                onRetry={payoutQuery.refetch}
              />
            ) : null}
            {!payoutQuery.isLoading && !payoutQuery.isError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-4">
                <div>
                  <p className="font-medium text-foreground">
                    'Manual payout tracking is active'
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pending earnings are paid manually by SyncExc after payment verification.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="warning">
                    {pendingEarnings}
                  </Badge>
                  <Button variant="outline" asChild>
                    <Link to={ROUTES.app.trader.revenue}><Wallet className="h-4 w-4" /> Manage payouts</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 'settings' ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace settings</CardTitle>
            <CardDescription>Manage your Trader profile, plans, and payout account.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link to={ROUTES.app.trader.profile}><UserRound className="h-4 w-4" /> Edit Trader profile</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to={ROUTES.app.trader.plans}><Layers3 className="h-4 w-4" /> Manage subscription plans</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to={ROUTES.app.trader.revenue}><Wallet className="h-4 w-4" /> Payout settings</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to={ROUTES.app.marketplace.browse}><ArrowRight className="h-4 w-4" /> Browse Marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SignalsCard({ signals, isLoading, error, onRetry, onViewAll, showAll = false }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Published signals</CardTitle>
            <CardDescription className="mt-1">Review and manage the signals you have published.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!showAll ? (
              <Button variant="ghost" size="sm" onClick={onViewAll}>
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onViewAll}>Clear search</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <LoadingState label="Loading published signals" /> : null}
        {error ? (
          <ErrorState
            title="Published signals unavailable"
            description={getErrorMessage(error)}
            onRetry={onRetry}
          />
        ) : null}
        {!isLoading && !error && signals.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No published signals yet"
            description="Publish a signal to start building your Marketplace presence."
            action={<Button asChild><Link to={ROUTES.app.trader.publishSignal}>Publish a signal</Link></Button>}
            size="sm"
            className="border-0 bg-transparent py-6"
          />
        ) : null}
        {!isLoading && !error && signals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Signal</th>
                  <th className="px-3 py-3 text-right font-medium">Copies</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {signals.map((signal) => (
                  <tr key={signal.id} className="hover:bg-muted/30">
                    <td className="max-w-56 truncate px-3 py-3 font-medium text-foreground">{signal.name}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{signal.copyCount.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <Badge variant={isPublished(signal.status) ? 'success' : 'muted'}>
                        {signal.status?.replaceAll('_', ' ') || 'draft'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={signal.href}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ items, isLoading }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Latest updates from your audience and published signals.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <LoadingState label="Loading recent activity" /> : null}
        {!isLoading && items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No recent activity"
            description="New subscribers and published signals will appear here."
            size="sm"
            className="border-0 bg-transparent py-4"
          />
        ) : null}
        {!isLoading && items.length > 0 ? (
          <div className="divide-y divide-border">
            {items.map(({ id, title, detail, date, icon: Icon }) => (
              <div key={id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={date}>
                  {formatRelativeTime(date)}
                </time>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function isActiveSignal(signal) {
  return ['published', 'updated'].includes(signal.status);
}

function isPublished(status) {
  return ['active', 'published', 'updated'].includes(status);
}
