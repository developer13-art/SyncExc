import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, ArrowUpRight, Layers3, Send, UserRound, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { useConnections } from '../../hooks/useConnections.js';
import { useTerminalOrders, useTerminalOverview, useTerminalPositions } from '../../hooks/useTerminal.js';
import { DashboardMarketPanel } from '../dashboard/DashboardMarketPanel.jsx';
import { OpenTradesWidget } from '../dashboard/OpenTradesWidget.jsx';
import { PortfolioOverview } from '../dashboard/PortfolioOverview.jsx';
import { RecentTradesWidget } from '../dashboard/RecentTradesWidget.jsx';
import { TradingDashboardMetrics } from '../dashboard/TradingDashboardMetrics.jsx';

export default function ProviderDashboard() {
  const { activeWorkspace, activeWorkspaceId, permissions = [] } = useWorkspaceContext();
  const canMonitorTrading = permissions.includes('trading.monitor');
  const canViewConnections = permissions.includes('connections.view');
  const dashboardQuery = useQuery({
    queryKey: ['marketplace', 'provider-dashboard', activeWorkspaceId],
    queryFn: () => marketplaceApi.getProviderDashboard(),
    enabled: activeWorkspace?.type === 'trader',
  });
  const connectionsQuery = useConnections({ status: 'active' }, canViewConnections);
  const overviewQuery = useTerminalOverview(canMonitorTrading ? activeWorkspaceId : null);
  const positionsQuery = useTerminalPositions(
    canMonitorTrading ? activeWorkspaceId : null,
    { status: 'open' },
  );
  const ordersQuery = useTerminalOrders(
    canMonitorTrading ? activeWorkspaceId : null,
    { limit: 10 },
  );

  if (dashboardQuery.isLoading) return <LoadingState label="Loading Trader dashboard" />;
  if (dashboardQuery.isError) {
    return (
      <ErrorState
        title="Trader dashboard unavailable"
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
        description="Create a profile for this Trader workspace before publishing signals or managing a subscriber audience."
        action={
          <Button asChild>
            <Link to={ROUTES.app.trader.profile}>Create Trader profile</Link>
          </Button>
        }
      />
    );
  }

  const stats = dashboard.stats ?? {};
  const recentSignals = dashboard.recentSignals ?? [];
  const metrics = [
    { label: 'Active subscribers', value: stats.active_subscribers ?? 0, icon: Users },
    { label: 'Signals published', value: stats.total_signals ?? 0, icon: Send },
    { label: 'Active signals', value: stats.active_signals ?? 0, icon: Activity },
    { label: 'Active plans', value: stats.active_plans ?? 0, icon: Layers3 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Trader workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {dashboard.provider.displayName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Monitor your trading activity, keep an eye on the market, and manage your subscribers and signals.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={dashboard.provider.moderationState === 'approved' ? 'success' : 'warning'}>
              {dashboard.provider.moderationState?.replaceAll('_', ' ') ?? 'profile pending'}
            </Badge>
            <Badge variant={dashboard.provider.visibility === 'public' ? 'info' : 'muted'}>
              {dashboard.provider.visibility ?? 'private'}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.trader.profile}>
              View profile <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild>
            <Link to={ROUTES.app.trader.publishSignal}>
              <Send className="h-4 w-4" /> Publish signal
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="overflow-hidden">
            <CardContent className="flex items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {canMonitorTrading ? (
        <TradingDashboardMetrics
          overview={overviewQuery.data}
          positions={positionsQuery.data ?? []}
          isLoading={overviewQuery.isLoading || positionsQuery.isLoading}
          error={overviewQuery.error || positionsQuery.error}
        />
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,0.8fr)]">
        <DashboardMarketPanel
          workspaceId={canMonitorTrading ? activeWorkspaceId : null}
          connections={connectionsQuery.data?.items ?? []}
          isLoadingConnections={connectionsQuery.isLoading}
          connectionsError={connectionsQuery.error}
          onRetryConnections={connectionsQuery.refetch}
          canViewConnections={canMonitorTrading && canViewConnections}
        />
        <div className="grid content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Recent signals</CardTitle>
                  <CardDescription className="mt-1">Your latest published marketplace activity.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={ROUTES.app.trader.signalHistory}>
                    View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentSignals.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No signals yet"
                  description="Publish a signal when your profile is approved and public."
                  action={<Button size="sm" asChild><Link to={ROUTES.app.trader.publishSignal}>Create a signal</Link></Button>}
                  size="sm"
                  className="border-0 bg-transparent py-4"
                />
              ) : (
                <div className="divide-y divide-border">
                  {recentSignals.slice(0, 4).map((signal) => (
                    <div key={signal.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {signal.instrument} <span className="text-muted-foreground">·</span> {signal.direction}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {signal.marketType} · {signal.entry ? `Entry ${signal.entry}` : 'Entry not specified'}
                        </p>
                      </div>
                      <Badge variant={signal.status === 'published' || signal.status === 'updated' ? 'success' : 'muted'}>
                        {signal.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trader tools</CardTitle>
              <CardDescription>Manage your audience, plans, and public profile.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <Button variant="outline" className="justify-start" asChild>
                <Link to={ROUTES.app.trader.subscribers}><Users className="h-4 w-4" /> Subscribers</Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to={ROUTES.app.trader.plans}><Layers3 className="h-4 w-4" /> Subscription plans</Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to={ROUTES.app.trader.profile}><UserRound className="h-4 w-4" /> Public profile</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {canMonitorTrading ? (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <OpenTradesWidget
              positions={positionsQuery.data ?? []}
              orders={ordersQuery.data?.items ?? []}
              isLoading={positionsQuery.isLoading || ordersQuery.isLoading}
              error={positionsQuery.error}
            />
            <RecentTradesWidget
              trades={overviewQuery.data?.recentTrades ?? []}
              isLoading={overviewQuery.isLoading}
              error={overviewQuery.error}
            />
          </div>
          <PortfolioOverview
            overview={overviewQuery.data}
            isLoading={overviewQuery.isLoading}
            error={overviewQuery.error}
            onRetry={overviewQuery.refetch}
          />
        </>
      ) : (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Connect an exchange and enable trading permissions to see live positions, portfolio, and market charts here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
