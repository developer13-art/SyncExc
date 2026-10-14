import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { useTerminalOverview } from '../../hooks/useTerminal.js';
import { useTerminalPositions } from '../../hooks/useTerminal.js';
import { useTerminalOrders } from '../../hooks/useTerminal.js';
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
import { ProfitLossWidget } from './ProfitLossWidget.jsx';
import { RiskOverviewWidget } from './RiskOverviewWidget.jsx';
import { AccountHealthWidget } from './AccountHealthWidget.jsx';
import { SubscriptionStatusWidget } from './SubscriptionStatusWidget.jsx';
import { ReferralSummaryWidget } from './ReferralSummaryWidget.jsx';

export default function DashboardOverview() {
  const dispatch = useDispatch();
  const toast = useToast();
  const { activeWorkspaceId, activeWorkspace } = useWorkspaceContext();

  const overviewQuery = useTerminalOverview(activeWorkspaceId);
  const positionsQuery = useTerminalPositions(activeWorkspaceId, { status: 'open' });
  const ordersQuery = useTerminalOrders(activeWorkspaceId, { status: 'open', limit: 10 });
  const exposureQuery = useRiskExposure({});
  const alertsQuery = useRiskAlerts({ limit: 5, status: 'active' });
  const connectionsQuery = useConnections({ status: 'active' });
  const signalsQuery = useSignals({ limit: 5, sort: '-occurredAt' });
  const subscriptionQuery = useSubscription();
  const referralQuery = useReferralDashboard();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Dashboard'));
    dispatch(uiActions.setBreadcrumbs([{ label: 'Dashboard', path: '/app/dashboard' }]));
  }, [dispatch]);

  const handleRefreshAll = async () => {
    await Promise.all([
      overviewQuery.refetch(),
      positionsQuery.refetch(),
      ordersQuery.refetch(),
      exposureQuery.refetch(),
      alertsQuery.refetch(),
      connectionsQuery.refetch(),
      signalsQuery.refetch(),
    ]);
    toast.success('Dashboard refreshed');
  };

  const isLoading =
    overviewQuery.isLoading ||
    positionsQuery.isLoading ||
    ordersQuery.isLoading ||
    exposureQuery.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {activeWorkspace?.name ?? 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of connected accounts, active positions, and recent activity across your
            workspace.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={handleRefreshAll}
          disabled={isLoading}
          className="border border-border"
        >
          <RefreshCw className="h-4 w-4" />
        </IconButton>
      </div>

      <ProfitLossWidget
        overview={overviewQuery.data}
        positions={positionsQuery.data ?? []}
        isLoading={overviewQuery.isLoading || positionsQuery.isLoading}
        error={overviewQuery.error}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PortfolioOverview
            overview={overviewQuery.data}
            isLoading={overviewQuery.isLoading}
            error={overviewQuery.error}
            onRetry={overviewQuery.refetch}
          />
        </div>
        <div>
          <LiveTradingStatus
            overview={overviewQuery.data}
            positions={positionsQuery.data ?? []}
            orders={ordersQuery.data?.items ?? []}
            isLoading={overviewQuery.isLoading || positionsQuery.isLoading}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AccountSummary
          overview={overviewQuery.data}
          isLoading={overviewQuery.isLoading}
          error={overviewQuery.error}
        />
        <RiskOverviewWidget
          exposure={exposureQuery.data}
          alerts={alertsQuery.data?.items ?? []}
          isLoading={exposureQuery.isLoading || alertsQuery.isLoading}
          error={exposureQuery.error}
        />
      </div>

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

      <div className="grid gap-5 lg:grid-cols-2">
        <ActiveSignalsWidget
          signals={signalsQuery.data?.items ?? []}
          isLoading={signalsQuery.isLoading}
          error={signalsQuery.error}
        />
        <AccountHealthWidget
          connections={connectionsQuery.data?.items ?? []}
          isLoading={connectionsQuery.isLoading}
          error={connectionsQuery.error}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SubscriptionStatusWidget
          subscription={subscriptionQuery.subscription}
          usage={subscriptionQuery.usage}
          isLoading={subscriptionQuery.isLoading}
        />
        <ReferralSummaryWidget
          dashboard={referralQuery.data}
          isLoading={referralQuery.isLoading}
        />
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
          <a href="/app/connections/new">Connect an exchange</a>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
          <a href="/app/sources/new">Add a signal source</a>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
          <a href="/app/automation/new">Create a workflow</a>
        </Button>
      </div>
    </div>
  );
}