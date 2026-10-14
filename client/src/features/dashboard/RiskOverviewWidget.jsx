import { Link } from 'react-router-dom';
import { AlertTriangle, Shield, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function RiskOverviewWidget({ exposure, alerts = [], isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Overview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Unable to load risk data.</p>
        </CardContent>
      </Card>
    );
  }

  const hasExposure = exposure && typeof exposure.grossExposure === 'number';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Risk Overview</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.app.risk.overview}>Open</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5 pt-0">
        {hasExposure ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="flex items-center gap-1 text-2xs uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Gross
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {formatCurrency(exposure.grossExposure, 'USD')}
              </p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Net</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {formatCurrency(exposure.netExposure, 'USD')}
              </p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {formatCurrency(exposure.pendingExposure ?? 0, 'USD')}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No exposure data available across connected accounts.
          </p>
        )}

        <div className="border-t border-border pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            Active alerts
          </p>
          {alerts.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No active alerts"
              description="Risk controls are within configured thresholds."
              size="sm"
              className="border-0 bg-transparent py-4"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {alerts.slice(0, 3).map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/5 px-3 py-2"
                >
                  <AlertTriangle
                    className={cn(
                      'mt-0.5 h-3 w-3 shrink-0',
                      alert.severity === 'critical' || alert.severity === 'high'
                        ? 'text-destructive'
                        : 'text-warning',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {alert.title}
                    </p>
                    {alert.description ? (
                      <p className="mt-0.5 line-clamp-1 text-2xs text-muted-foreground">
                        {alert.description}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      alert.severity === 'critical' || alert.severity === 'high'
                        ? 'destructive'
                        : 'warning'
                    }
                    size="sm"
                  >
                    {alert.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}