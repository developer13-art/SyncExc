import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { RefreshCw, ShieldCheck, Zap } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { MetricTiles } from './MetricTiles.jsx';
import { HealthWidgets } from './HealthWidgets.jsx';
import { AlertList } from './AlertList.jsx';
import { SubscriptionHealthWidget } from './SubscriptionHealthWidget.jsx';
import { PaymentHealthWidget } from './PaymentHealthWidget.jsx';
import { ExchangeInfrastructureWidget } from './ExchangeInfrastructureWidget.jsx';
import { SignalIntelligenceWidget } from './SignalIntelligenceWidget.jsx';
import { ReferralGovernanceWidget } from './ReferralGovernanceWidget.jsx';
import { SupportOperationsWidget } from './SupportOperationsWidget.jsx';
import { SecurityGovernanceWidget } from './SecurityGovernanceWidget.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { adminApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/queryKeys.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function PlatformOverview() {
  const dispatch = useDispatch();
  const toast = useToast();
  const { admin } = useAuthContext();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Platform overview'));
    dispatch(uiActions.setBreadcrumbs([]));
  }, [dispatch]);

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.get({}),
    queryFn: () => adminApi.getDashboard({}),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const healthQuery = useQuery({
    queryKey: queryKeys.dashboard.health,
    queryFn: () => adminApi.getHealth(),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const handleRefresh = async () => {
    try {
      await Promise.all([dashboardQuery.refetch(), healthQuery.refetch()]);
      toast.success('Dashboard refreshed');
    } catch (err) {
      toast.error('Refresh failed', { description: getErrorMessage(err) });
    }
  };

  if (dashboardQuery.isLoading || healthQuery.isLoading) {
    return <LoadingState label="Loading platform overview" />;
  }

  if (dashboardQuery.isError || healthQuery.isError) {
    return (
      <ErrorState
        title="Unable to load platform overview"
        description="We could not fetch the platform dashboard."
        onRetry={() => {
          dashboardQuery.refetch();
          healthQuery.refetch();
        }}
      />
    );
  }

  const dashboard = dashboardQuery.data ?? {};
  const health = healthQuery.data ?? {};

  const alerts = dashboard.alerts ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Platform overview
            </h1>
            <Badge variant="muted" size="sm">
              <ShieldCheck className="mr-1 h-3 w-3" />
              {admin?.roleSummary ?? 'Administrator'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {dashboard.lastUpdatedAt
              ? `Last updated ${formatRelativeTime(dashboard.lastUpdatedAt)}`
              : 'Operational starting point for the platform.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.console.alerts.events}>
              <Zap className="h-4 w-4" /> Alerts
            </Link>
          </Button>
          <IconButton
            label="Refresh"
            onClick={handleRefresh}
            disabled={dashboardQuery.isFetching || healthQuery.isFetching}
            className="border border-border"
          >
            <RefreshCw
              className={
                dashboardQuery.isFetching || healthQuery.isFetching
                  ? 'h-4 w-4 animate-spin'
                  : 'h-4 w-4'
              }
            />
          </IconButton>
        </div>
      </div>

      {dashboard.dataFreshnessWarning ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 pt-4 text-xs text-warning">
            {dashboard.dataFreshnessWarning}
          </CardContent>
        </Card>
      ) : null}

      <MetricTiles metrics={dashboard.metrics} isLoading={false} error={null} />

      <HealthWidgets health={health} isLoading={false} error={null} />

      <AlertList alerts={alerts} isLoading={false} error={null} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SubscriptionHealthWidget
          data={dashboard.subscriptionHealth}
          isLoading={false}
          error={null}
        />
        <PaymentHealthWidget
          data={dashboard.paymentHealth}
          isLoading={false}
          error={null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ExchangeInfrastructureWidget
          data={dashboard.exchangeInfrastructure}
          isLoading={false}
          error={null}
        />
        <SignalIntelligenceWidget
          data={dashboard.signalIntelligence}
          isLoading={false}
          error={null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ReferralGovernanceWidget
          data={dashboard.referralGovernance}
          isLoading={false}
          error={null}
        />
        <SupportOperationsWidget
          data={dashboard.supportOperations}
          isLoading={false}
          error={null}
        />
        <SecurityGovernanceWidget
          data={dashboard.securityGovernance}
          isLoading={false}
          error={null}
        />
      </div>

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          This dashboard is an operational overview. Underlying records remain authoritative in
          their respective modules. Any drill-down link re-evaluates authorization for the
          specific record you are trying to view.
        </CardContent>
      </Card>
    </div>
  );
}