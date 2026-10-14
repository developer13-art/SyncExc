import { AlertCircle, CheckCircle2, Clock, Server, WifiOff } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { cn } from '../../lib/utils/cn.util.js';

const HEALTH_VARIANTS = {
  healthy: { variant: 'success', icon: CheckCircle2, label: 'Healthy' },
  degraded: { variant: 'warning', icon: AlertCircle, label: 'Degraded' },
  unavailable: { variant: 'destructive', icon: WifiOff, label: 'Unavailable' },
  maintenance: { variant: 'info', icon: Clock, label: 'Maintenance' },
};

export function HealthWidgets({ health, isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Unable to load health data.</p>
        </CardContent>
      </Card>
    );
  }

  const services = health?.services ?? [];
  const incidents = health?.activeIncidents ?? [];
  const dataFreshness = health?.dataFreshness;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Service health</CardTitle>
            </div>
            <Badge
              variant={
                health?.overallStatus === 'healthy'
                  ? 'success'
                  : health?.overallStatus === 'degraded'
                    ? 'warning'
                    : 'destructive'
              }
            >
              {health?.overallStatus ?? 'unknown'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {services.length === 0 ? (
            <EmptyState
              title="No services reported"
              description="Service health will appear here."
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {services.map((service) => {
                const config = HEALTH_VARIANTS[service.status] ?? HEALTH_VARIANTS.healthy;
                const Icon = config.icon;
                return (
                  <li
                    key={service.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          config.variant === 'success' && 'text-success',
                          config.variant === 'warning' && 'text-warning',
                          config.variant === 'destructive' && 'text-destructive',
                          config.variant === 'info' && 'text-info',
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {service.name}
                        </p>
                        {service.detail ? (
                          <p className="truncate text-2xs text-muted-foreground">
                            {service.detail}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {service.latencyMs !== undefined ? (
                        <span className="text-2xs text-muted-foreground">
                          {service.latencyMs}ms
                        </span>
                      ) : null}
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active incidents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {incidents.length === 0 ? (
            <EmptyState
              title="No active incidents"
              description="All systems are operating normally."
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {incidents.map((incident) => (
                <li key={incident.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {incident.title}
                    </p>
                    <Badge
                      variant={
                        incident.severity === 'critical' || incident.severity === 'high'
                          ? 'destructive'
                          : 'warning'
                      }
                    >
                      {incident.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    Started {formatRelativeTime(incident.startedAt)}
                    {incident.owner ? ` · ${incident.owner}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {dataFreshness ? (
        <Card className="lg:col-span-3">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 pt-4 text-xs">
            <span className="text-muted-foreground">Data freshness:</span>
            {Object.entries(dataFreshness).map(([key, value]) => (
              <span key={key} className="flex items-center gap-1">
                <span className="text-muted-foreground">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span
                  className={cn(
                    'font-medium',
                    value === 'current' && 'text-success',
                    value === 'stale' && 'text-warning',
                    value === 'unavailable' && 'text-destructive',
                  )}
                >
                  {value}
                </span>
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}