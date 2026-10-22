import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import {
  useTerminalAccountsSync,
  useTerminalOverview,
  useTerminalPositions,
  useTerminalOrders,
} from '../../hooks/useTerminal.js';
import { useRiskExposure } from '../../hooks/useRisk.js';
import { useRiskAlerts } from '../../hooks/useRisk.js';
import { useConnections } from '../../hooks/useConnections.js';
import { useSignals } from '../../hooks/useSignals.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { useReferralDashboard } from '../../hooks/useReferrals.js';
import { useToast } from '../../hooks/useToast.js';
import { AccountSummary } from './AccountSummary.jsx';
import { PortfolioOverview } from './PortfolioOverview.jsx';
import { LiveTradingStatus } from './LiveTradingStatus.jsx';
import { ActiveSignalsWidget } from './ActiveSignalsWidget.jsx';
import { OpenTradesWidget } from './OpenTradesWidget.jsx';
import { RecentTradesWidget } from './RecentTradesWidget.jsx';
import { RiskOverviewWidget } from './RiskOverviewWidget.jsx';
import { AccountHealthWidget } from './AccountHealthWidget.jsx';
import { SubscriptionStatusWidget } from './SubscriptionStatusWidget.jsx';
import { ReferralSummaryWidget } from './ReferralSummaryWidget.jsx';
import { DashboardMarketPanel } from './DashboardMarketPanel.jsx';
import { TradingDashboardMetrics } from './TradingDashboardMetrics.jsx';

export default function DashboardOverview() {
  const dispatch = useDispatch();
  const toast = useToast();
  const { user } = useAuthContext();
  const {
    activeWorkspaceId,
    activeWorkspace,
    permissions,
    isLoading: isLoadingWorkspaces,
    isWorkspaceReady,
    error: workspaceError,
    reloadWorkspaces,
  } = useWorkspaceContext();
  const workspaceId = isWorkspaceReady ? activeWorkspaceId : null;
  const canMonitorTrading = permissions.includes('trading.monitor');
  const canViewRisk = permissions.includes('risk.view');
  const canViewConnections = permissions.includes('connections.view');

  const overviewQuery = useTerminalOverview(canMonitorTrading ? workspaceId : null);
  const positionsQuery = useTerminalPositions(
    canMonitorTrading ? workspaceId : null,
    { status: 'open' },
  );
  const ordersQuery = useTerminalOrders(
    canMonitorTrading ? workspaceId : null,
    { limit: 10 },
  );
  const exposureQuery = useRiskExposure({}, isWorkspaceReady && canViewRisk);
  const alertsQuery = useRiskAlerts(
    { limit: 5, status: 'active' },
    isWorkspaceReady && canViewRisk,
  );
  const connectionsQuery = useConnections(
    {},
    isWorkspaceReady && canViewConnections,
  );
  const exchangeAccounts = canViewConnections
    ? (connectionsQuery.data?.items ?? [])
      .filter((connection) => connection.status === 'active')
      .flatMap((connection) =>
        (connection.accounts ?? [])
          .filter((account) => account.status === 'active')
          .map((account) => ({ id: account.id }))
      )
    : [];
  const accountSyncQuery = useTerminalAccountsSync(
    canMonitorTrading ? workspaceId : null,
    exchangeAccounts,
  );
  const signalsQuery = useSignals({ limit: 5 }, isWorkspaceReady);
  const subscriptionQuery = useSubscription();
  const referralQuery = useReferralDashboard();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Dashboard'));
    dispatch(uiActions.setBreadcrumbs([{ label: 'Dashboard', path: '/app/dashboard' }]));
  }, [dispatch]);

  if (workspaceError) {
    return (
      <ErrorState
        title="Unable to load workspaces"
        description="Dashboard data cannot load until your workspace access is available."
        onRetry={reloadWorkspaces}
      />
    );
  }

  const handleRefreshAll = async () => {
    await Promise.all([
      canMonitorTrading ? overviewQuery.refetch() : Promise.resolve(),
      canMonitorTrading ? positionsQuery.refetch() : Promise.resolve(),
      canMonitorTrading ? ordersQuery.refetch() : Promise.resolve(),
      canViewRisk ? exposureQuery.refetch() : Promise.resolve(),
      canViewRisk ? alertsQuery.refetch() : Promise.resolve(),
      canViewConnections ? connectionsQuery.refetch() : Promise.resolve(),
      canMonitorTrading && exchangeAccounts.length
        ? accountSyncQuery.refetch()
        : Promise.resolve(),
      signalsQuery.refetch(),
    ]);
    toast.success('Dashboard refreshed');
  };

  const isLoading =
    isLoadingWorkspaces ||
    (canMonitorTrading && overviewQuery.isLoading) ||
    positionsQuery.isLoading ||
    ordersQuery.isLoading ||
    exposureQuery.isLoading;
  const firstName =
    user?.displayName?.trim().split(/\s+/)[0] ||
    user?.firstName ||
    user?.email?.split('@')[0] ||
    'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Account overview</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeWorkspace?.name ?? 'Your workspace'} · Track your portfolio, positions, and market activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/terminal">Open terminal</Link>
          </Button>
          <IconButton
            label="Refresh dashboard"
            onClick={handleRefreshAll}
            disabled={isLoading}
            className="border border-border bg-background"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </IconButton>
        </div>
      </header>

      {accountSyncQuery.error ? (
        <p className="text-xs text-destructive">
          Exchange trade-history sync failed: {accountSyncQuery.error.message}
        </p>
      ) : null}

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
          workspaceId={canMonitorTrading ? workspaceId : null}
          connections={connectionsQuery.data?.items ?? []}
          isLoadingConnections={connectionsQuery.isLoading}
          connectionsError={connectionsQuery.error}
          onRetryConnections={connectionsQuery.refetch}
          canViewConnections={isWorkspaceReady && canMonitorTrading && canViewConnections}
        />
        <div className="grid content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
          {canMonitorTrading ? (
            <>
              <LiveTradingStatus
                overview={overviewQuery.data}
                positions={positionsQuery.data ?? []}
                orders={ordersQuery.data?.items ?? []}
                isLoading={overviewQuery.isLoading || positionsQuery.isLoading}
              />
              <ActiveSignalsWidget
                signals={signalsQuery.data?.items ?? []}
                isLoading={signalsQuery.isLoading}
                error={signalsQuery.error}
              />
            </>
          ) : null}
        </div>
      </div>

      {canMonitorTrading ? (
        <div className="grid gap-5 lg:grid-cols-2">
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
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]">
        {canMonitorTrading ? (
          <PortfolioOverview
            overview={overviewQuery.data}
            isLoading={overviewQuery.isLoading}
            error={overviewQuery.error}
            onRetry={overviewQuery.refetch}
          />
        ) : null}
        {canMonitorTrading ? (
          <AccountSummary
            overview={overviewQuery.data}
            isLoading={overviewQuery.isLoading}
            error={overviewQuery.error}
          />
        ) : null}
      </div>

      {isWorkspaceReady && (!canMonitorTrading || !canViewRisk || !canViewConnections) ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Some dashboard sections are hidden because your selected workspace role lacks the
            required permissions.
            {!canMonitorTrading ? ' Trading monitor permission is required for portfolio data.' : ''}
            {!canViewRisk ? ' Risk view permission is required for risk data.' : ''}
            {!canViewConnections ? ' Connections view permission is required for exchange data.' : ''}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        {canViewRisk ? (
          <RiskOverviewWidget
            exposure={exposureQuery.data}
            alerts={alertsQuery.data?.items ?? []}
            isLoading={exposureQuery.isLoading || alertsQuery.isLoading}
            error={exposureQuery.error}
          />
        ) : null}
        {canViewConnections ? (
          <AccountHealthWidget
            connections={connectionsQuery.data?.items ?? []}
            isLoading={connectionsQuery.isLoading}
            error={connectionsQuery.error}
          />
        ) : null}
        <SubscriptionStatusWidget
          subscription={subscriptionQuery.subscription}
          usage={subscriptionQuery.usage}
          isLoading={subscriptionQuery.isLoading}
        />
        <ReferralSummaryWidget dashboard={referralQuery.data} isLoading={referralQuery.isLoading} />
        <QuickActionsCard />
      </div>
    </div>
  );
}

function QuickActionsCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
      <div className="mt-3 flex flex-col gap-2">
        <Button variant="outline" className="justify-start" asChild>
        <Link to="/app/connections/new">Connect an exchange</Link>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
        <Link to="/app/sources/new">Add a signal source</Link>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
        <Link to="/app/automation/new">Create a workflow</Link>
        </Button>
      </div>
    </div>
  );
}