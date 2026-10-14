import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Shield, ShieldAlert, TrendingUp } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ExposureSummary } from './components/ExposureSummary.jsx';
import { EmergencyPauseButton } from './components/EmergencyPauseButton.jsx';
import { useRiskExposure, useRiskAlerts, useEmergencyPause, useRiskApprovals } from '../../hooks/useRisk.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export default function RiskOverview() {
  const dispatch = useDispatch();
  const toast = useToast();
  const { activeWorkspaceId } = useWorkspaceContext();

  const exposureQuery = useRiskExposure({});
  const alertsQuery = useRiskAlerts({ limit: 5 });
  const approvalsQuery = useRiskApprovals({ status: 'pending' });
  const emergencyQuery = useEmergencyPause();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Risk Management'));
    dispatch(
      uiActions.setBreadcrumbs([{ label: 'Risk', path: ROUTES.app.risk.overview }]),
    );
  }, [dispatch]);

  const handleEmergencyPause = async (payload) => {
    try {
      await emergencyQuery.requestPause(payload);
      toast.success('Emergency pause requested', {
        description: 'New dispatches in the selected scope are being blocked.',
      });
    } catch (err) {
      toast.error('Pause request failed', { description: getErrorMessage(err) });
      throw err;
    }
  };

  const activeAlerts = alertsQuery.data?.items ?? [];
  const pendingApprovals = approvalsQuery.data?.items ?? [];
  const emergencyStatus = emergencyQuery.status;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Risk Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every consequential operation passes through the same risk engine: order limits,
            position limits, leverage ceilings, and exposure checks.
          </p>
        </div>
        <EmergencyPauseButton
          onRequestPause={handleEmergencyPause}
          isSubmitting={emergencyQuery.isLoading}
          scopeOptions={{}}
        />
      </div>

      {emergencyStatus?.isActive ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4 pt-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">
                Emergency pause is active
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                New eligible dispatches are blocked in {emergencyStatus.scope} scope. Existing
                exchange orders remain subject to the exchange's own rules.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                asChild
              >
                <Link to={ROUTES.app.risk.emergency}>View pause details</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Active policies"
          value={alertsQuery.data?.meta?.activePolicies ?? '—'}
          href={ROUTES.app.risk.policies}
        />
        <SummaryCard
          label="Pending approvals"
          value={pendingApprovals.length}
          tone={pendingApprovals.length > 0 ? 'warning' : undefined}
          href={ROUTES.app.risk.approvals}
        />
        <SummaryCard
          label="Active alerts"
          value={activeAlerts.length}
          tone={
            activeAlerts.some((a) => a.severity === 'critical' || a.severity === 'high')
              ? 'destructive'
              : activeAlerts.length > 0
                ? 'warning'
                : undefined
          }
          href={ROUTES.app.risk.alerts}
        />
        <SummaryCard
          label="Open incidents"
          value={alertsQuery.data?.meta?.openIncidents ?? '—'}
          href={ROUTES.app.risk.incidents}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {exposureQuery.isLoading ? (
            <LoadingState label="Loading exposure" />
          ) : exposureQuery.isError ? (
            <ErrorState
              title="Unable to load exposure"
              description="We could not fetch exposure data across connected accounts."
              onRetry={exposureQuery.refetch}
            />
          ) : (
            <ExposureSummary exposure={exposureQuery.data} />
          )}
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent alerts</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to={ROUTES.app.risk.alerts}>View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activeAlerts.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No active alerts"
                description="Risk controls are within configured thresholds."
                size="sm"
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <ul className="divide-y divide-border">
                {activeAlerts.slice(0, 5).map((alert) => (
                  <li key={alert.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {alert.title}
                      </p>
                      {alert.createdAt ? (
                        <p className="mt-0.5 text-2xs text-muted-foreground">
                          {formatRelativeTime(alert.createdAt)}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      variant={
                        alert.severity === 'critical' || alert.severity === 'high'
                          ? 'destructive'
                          : 'warning'
                      }
                    >
                      {alert.severity}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Pending approvals</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={ROUTES.app.risk.approvals}>
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pendingApprovals.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="No pending approvals"
              description="Approval requests appear here."
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {pendingApprovals.slice(0, 5).map((approval) => (
                <li key={approval.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {approval.operationSummary ?? approval.action}
                    </p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      Requested by {approval.requestedBy ?? 'unknown'} ·{' '}
                      {approval.createdAt ? formatRelativeTime(approval.createdAt) : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={ROUTES.app.risk.approvals}>Review</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone, href }) {
  return (
    <Link
      to={href}
      className="rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-primary/40"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold',
          tone === 'destructive' && 'text-destructive',
          tone === 'warning' && 'text-warning',
          !tone && 'text-foreground',
        )}
      >
        {value}
      </p>
    </Link>
  );
}