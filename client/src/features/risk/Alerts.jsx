import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { BellOff, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useRiskAlerts } from '../../hooks/useRisk.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export default function Alerts() {
  const dispatch = useDispatch();
  const toast = useToast();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Risk Alerts'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Risk', path: ROUTES.app.risk.overview },
        { label: 'Alerts', path: ROUTES.app.risk.alerts },
      ]),
    );
  }, [dispatch]);

  const alertsQuery = useRiskAlerts({});
  const alerts = alertsQuery.alerts ?? [];

  const handleAcknowledge = async (alert) => {
    try {
      await alertsQuery.acknowledge({ alertId: alert.id, reason: 'Reviewed' });
      toast.success('Alert acknowledged');
    } catch (error) {
      toast.error('Failed to acknowledge', { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Risk Alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational warnings and critical incidents requiring attention.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => alertsQuery.refetch?.()}
          className="border border-border"
        >
          <RefreshCw
            className={alertsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      <Card>
        <CardContent className="p-0">
          {alertsQuery.isLoading ? (
            <LoadingState label="Loading alerts" />
          ) : alertsQuery.isError ? (
            <ErrorState
              title="Unable to load alerts"
              description="We could not fetch risk alerts."
              onRetry={alertsQuery.refetch}
            />
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="No active alerts"
              description="Risk controls are within configured thresholds."
              size="sm"
              className="border-0 bg-transparent py-10"
            />
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <Badge
                        variant={
                          alert.severity === 'critical' || alert.severity === 'high'
                            ? 'destructive'
                            : 'warning'
                        }
                      >
                        {alert.severity}
                      </Badge>
                      {alert.acknowledgedAt ? (
                        <Badge variant="muted">Acknowledged</Badge>
                      ) : null}
                    </div>
                    {alert.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{alert.description}</p>
                    ) : null}
                    <p className="mt-1 text-2xs text-muted-foreground">
                      {alert.createdAt ? formatRelativeTime(alert.createdAt) : ''}
                      {alert.scope ? ` · ${alert.scope}` : ''}
                    </p>
                  </div>
                  {!alert.acknowledgedAt ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcknowledge(alert)}
                    >
                      Acknowledge
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}