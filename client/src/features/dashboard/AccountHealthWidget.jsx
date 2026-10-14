import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, WifiOff } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ConnectionHealthBadge } from '../../components/domain/connection/ConnectionHealthBadge.jsx';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function AccountHealthWidget({ connections = [], isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Unable to load connection health.</p>
        </CardContent>
      </Card>
    );
  }

  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Health</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Activity}
            title="No active connections"
            description="Connect a supported exchange to monitor connection health."
            size="sm"
            className="border-0 bg-transparent py-6"
          />
        </CardContent>
      </Card>
    );
  }

  const healthy = connections.filter((c) => c.health?.status === 'healthy').length;
  const degraded = connections.filter((c) => c.health?.status === 'degraded').length;
  const unavailable = connections.filter(
    (c) => c.health?.status === 'unavailable' || c.health?.status === 'reauth_required',
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Account Health</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.app.connections.overview}>Manage</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5 pt-0">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="font-medium text-foreground">{healthy}</span>
            <span className="text-muted-foreground">healthy</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span className="font-medium text-foreground">{degraded}</span>
            <span className="text-muted-foreground">degraded</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
            <span className="font-medium text-foreground">{unavailable}</span>
            <span className="text-muted-foreground">issues</span>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {connections.slice(0, 4).map((connection) => (
            <Link
              key={connection.id}
              to={ROUTES.app.connections.details(connection.id)}
              className="flex items-center justify-between gap-3 py-2 transition hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {connection.label ?? connection.exchangeName}
                </p>
                <p className="text-2xs text-muted-foreground">
                  {connection.lastSyncedAt
                    ? `Synced ${formatRelativeTime(connection.lastSyncedAt)}`
                    : 'Never synced'}
                </p>
              </div>
              <ConnectionHealthBadge status={connection.health?.status} />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}