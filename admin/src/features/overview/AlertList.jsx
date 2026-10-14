import { Link } from 'react-router-dom';
import { ArrowRight, BellOff, ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function AlertList({ alerts = [], isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Critical alerts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Critical alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Unable to load alerts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Critical alerts</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.console.alerts.events}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {alerts.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="No active alerts"
            description="Operational thresholds are within configured ranges."
            size="sm"
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex items-start justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {alert.title}
                    </p>
                    <Badge
                      variant={
                        alert.severity === 'critical' || alert.severity === 'high'
                          ? 'destructive'
                          : 'warning'
                      }
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  {alert.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {alert.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {alert.createdAt ? formatRelativeTime(alert.createdAt) : ''}
                    {alert.scope ? ` · ${alert.scope}` : ''}
                    {alert.owner ? ` · assigned to ${alert.owner}` : ''}
                  </p>
                </div>
                {alert.actionUrl ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={alert.actionUrl}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}