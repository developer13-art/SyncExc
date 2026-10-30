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
  ['listings', 'Listings'],
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
  const strategiesQuery = useQuery({
    queryKey: ['marketplace', 'my-strategies', activeWorkspaceId],
    queryFn: () => marketplaceApi.listMyStrategies(),
    enabled: activeWorkspace?.type === 'trader' && Boolean(dashboardQuery.data?.provider),
    staleTime: 30_000,
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
    queryKey: ['marketplace', 'payout-account', activeWorkspaceId],
    queryFn: () => marketplaceApi.getPayoutAccountStatus(),
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
        description="Create a Trader profile for this workspace before publishing listings or managing subscribers."
        action={
          <Button asChild>
            <Link to={ROUTES.app.trader.profile}>Create Trader profile</Link>
          </Button>
        }
      />
    );
  }

  const stats = dashboard.stats ?? {};
  const strategies = Array.isArray(strategiesQuery.data) ? strategiesQuery.data : [];
  const signals = signalsQuery.data?.items ?? dashboard.recentSignals ?? [];
  const subscribers = subscribersQuery.data?.items ?? [];
  const listings = [
    ...strategies.map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      type: 'Strategy',
      price: getStrategyPrice(strategy.pricing),
      audience: Number(strategy.followerCount || 0),
      status: strategy.status,
      updatedAt: strategy.updatedAt || strategy.createdAt,
      href: ROUTES.app.marketplace.strategy(strategy.id),
    })),
    ...signals.map((signal) => ({
      id: signal.id,
      name: `${signal.instrument} · ${signal.direction}`,
      type: 'Signal',
      price: '—',
      audience: Number(signal.copyCount || 0),
      status: signal.status,
      updatedAt: signal.updatedAt || signal.entryTime,
      href: ROUTES.app.trader.signalHistory,
    })),
  ];
  const filteredListings = listings.filter((listing) =>
    `${listing.name} ${listing.type} ${listing.status}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const totalSignals = Number(stats.total_signals ?? signals.length);
  const activeSignals = Number(stats.active_signals ?? signals.filter(isActiveSignal).length);
  const totalListingCount = totalSignals + strategies.length;
  const activeListingCount = activeSignals + strategies.filter(isActiveStrategy).length;
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
      label: 'Active listings',
      value: `${activeListingCount.toLocaleString()} / ${totalListingCount.toLocaleString()}`,
      detail: 'Published signals and strategies',
      icon: Layers3,
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
  const listingsError = strategiesQuery.error || signalsQuery.error;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Trader workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">My Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your listings, track performance, and grow your audience.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 sm:w-72">
            <span className="sr-only">Search listings</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search listings, signals, or strategies"
              className="pl-9"
            />
          </label>
          <Button asChild>
            <Link to={ROUTES.app.trader.createListing}><Layers3 className="h-4 w-4" /> Create listing</Link>
          </Button>
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
          <ListingsCard
            listings={filteredListings.slice(0, 5)}
            isLoading={strategiesQuery.isLoading || signalsQuery.isLoading}
            error={listingsError}
            onRetry={() => {
              strategiesQuery.refetch();
              signalsQuery.refetch();
            }}
            onViewAll={() => setActiveTab('listings')}
          />
          <RecentActivity
            items={recentActivity}
            isLoading={subscribersQuery.isLoading || signalsQuery.isLoading}
          />
        </div>
      ) : null}

      {activeTab === 'listings' ? (
        <ListingsCard
          listings={filteredListings}
          isLoading={strategiesQuery.isLoading || signalsQuery.isLoading}
          error={listingsError}
          onRetry={() => {
            strategiesQuery.refetch();
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
                    {payoutQuery.data?.status === 'ready'
                      ? 'Payout account ready'
                      : payoutQuery.data?.status === 'onboarding_required'
                        ? 'Complete payout account setup'
                        : 'Payout account not connected'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {payoutQuery.data?.payoutsEnabled
                      ? 'Payouts are enabled for your account.'
                      : 'Complete provider verification to enable payouts.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={payoutQuery.data?.status === 'ready' ? 'success' : 'warning'}>
                    {payoutQuery.data?.status?.replaceAll('_', ' ') || 'unknown'}
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

function ListingsCard({ listings, isLoading, error, onRetry, onViewAll, showAll = false }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Your listings</CardTitle>
            <CardDescription className="mt-1">Review and manage your Marketplace listings.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!showAll ? (
              <Button variant="ghost" size="sm" onClick={onViewAll}>
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onViewAll}>Clear search</Button>
            )}
            <Button size="sm" asChild>
              <Link to={ROUTES.app.trader.createListing}><Layers3 className="h-4 w-4" /> Create listing</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <LoadingState label="Loading listings" /> : null}
        {error ? (
          <ErrorState
            title="Listings unavailable"
            description={getErrorMessage(error)}
            onRetry={onRetry}
          />
        ) : null}
        {!isLoading && !error && listings.length === 0 ? (
          <EmptyState
            icon={Layers3}
            title="No listings yet"
            description="Create a strategy listing or publish a signal to start building your Marketplace presence."
            action={<Button asChild><Link to={ROUTES.app.trader.createListing}>Create listing</Link></Button>}
            size="sm"
            className="border-0 bg-transparent py-6"
          />
        ) : null}
        {!isLoading && !error && listings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 text-right font-medium">Audience</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listings.map((listing) => (
                  <tr key={`${listing.type}-${listing.id}`} className="hover:bg-muted/30">
                    <td className="max-w-56 truncate px-3 py-3 font-medium text-foreground">{listing.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{listing.type}</td>
                    <td className="px-3 py-3 text-muted-foreground">{listing.price}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{listing.audience.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <Badge variant={isPublished(listing.status) ? 'success' : 'muted'}>
                        {listing.status?.replaceAll('_', ' ') || 'draft'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={listing.href}>View</Link>
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
        <CardDescription>Latest updates from your audience and listings.</CardDescription>
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

function getStrategyPrice(pricing) {
  if (!pricing) return '—';
  const amount = Number(pricing.amountMinor);
  if (!Number.isFinite(amount)) return '—';
  if (amount === 0) return 'Free';
  return `${formatCurrency(amount / 100, pricing.currency || 'USD')} / ${pricing.billingInterval || 'month'}`;
}

function isActiveSignal(signal) {
  return ['published', 'updated'].includes(signal.status);
}

function isActiveStrategy(strategy) {
  return ['active', 'published'].includes(strategy.status);
}

function isPublished(status) {
  return ['active', 'published', 'updated'].includes(status);
}
