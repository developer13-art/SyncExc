import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, Send, Users, UserRound, Layers3 } from 'lucide-react';
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

export default function ProviderDashboard() {
  const { activeWorkspace, activeWorkspaceId } = useWorkspaceContext();
  const dashboardQuery = useQuery({
    queryKey: ['marketplace', 'provider-dashboard', activeWorkspaceId],
    queryFn: () => marketplaceApi.getProviderDashboard(),
    enabled: activeWorkspace?.type === 'trader',
  });

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Trader dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome, {dashboard.provider.displayName}. Manage your audience, subscription plans, and published signals.
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
        <Button asChild>
          <Link to={ROUTES.app.trader.publishSignal}>
            <Send className="h-4 w-4" /> Publish signal
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Recent signals</CardTitle>
            <CardDescription>Your latest published marketplace signals.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSignals.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No signals yet"
                description="Publish a signal when your profile is approved and public."
                action={<Button asChild><Link to={ROUTES.app.trader.publishSignal}>Create a signal</Link></Button>}
              />
            ) : (
              <div className="divide-y divide-border">
                {recentSignals.map((signal) => (
                  <div key={signal.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {signal.instrument} · {signal.direction}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
            <Button variant="link" asChild className="mt-3 px-0">
              <Link to={ROUTES.app.trader.signalHistory}>View all signals <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trader tools</CardTitle>
            <CardDescription>Manage the parts of your provider account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-2">
            <Button variant="ghost" asChild><Link to={ROUTES.app.trader.subscribers}><Users className="h-4 w-4" /> Subscribers</Link></Button>
            <Button variant="ghost" asChild><Link to={ROUTES.app.trader.plans}><Layers3 className="h-4 w-4" /> Subscription plans</Link></Button>
            <Button variant="ghost" asChild><Link to={ROUTES.app.trader.profile}><UserRound className="h-4 w-4" /> Public profile</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
