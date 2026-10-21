import { Link } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { cn } from '../../lib/utils/cn.util.js';
import { ROUTES } from '../../config/routes.config.js';

const PENDING_ORDER_STATUSES = new Set([
  'pending_submission',
  'submitted',
  'acknowledged',
  'partially_filled',
  'cancel_requested',
  'unknown',
  'reconciliation_required',
]);

export function LiveTradingStatus({ overview, positions = [], orders = [], isLoading }) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Live Trading Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    );
  }

  const pausedGroups = overview?.pausedSyncGroupCount ?? 0;
  const activeGroups = overview?.activeSyncGroupCount ?? 0;
  const unresolvedOperations = overview?.unresolvedOperationCount ?? 0;
  const reconciliationRequired = overview?.reconciliationRequiredCount ?? 0;

  const items = [
    {
      label: 'Active sync groups',
      value: activeGroups,
      tone: 'info',
      href: ROUTES.app.synchronization.overview,
    },
    {
      label: 'Open positions',
      value: positions.length,
      tone: positions.length > 0 ? 'info' : 'muted',
      href: ROUTES.app.terminal.positions,
    },
    {
      label: 'Pending orders',
      value: orders.filter((order) => PENDING_ORDER_STATUSES.has(order.status)).length,
      tone: 'warning',
      href: ROUTES.app.terminal.orders,
    },
    {
      label: 'Unresolved operations',
      value: unresolvedOperations,
      tone: unresolvedOperations > 0 ? 'destructive' : 'muted',
      href: ROUTES.app.synchronization.allOperations,
    },
    {
      label: 'Reconciliation required',
      value: reconciliationRequired,
      tone: reconciliationRequired > 0 ? 'destructive' : 'muted',
      href: ROUTES.app.synchronization.overview,
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Live Trading Status</CardTitle>
          <Badge variant="success">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success" />
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-5 pt-0">
        {pausedGroups > 0 ? (
          <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            {pausedGroups} sync group{pausedGroups !== 1 ? 's' : ''} currently paused
          </div>
        ) : null}

        {items.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className="flex items-center justify-between gap-3 rounded-md border border-transparent px-2 py-2 text-sm transition hover:border-border hover:bg-muted/40"
          >
            <span className="flex items-center gap-2">
              <Activity
                className={cn(
                  'h-3.5 w-3.5',
                  item.tone === 'destructive' && 'text-destructive',
                  item.tone === 'warning' && 'text-warning',
                  item.tone === 'info' && 'text-info',
                  item.tone === 'muted' && 'text-muted-foreground',
                )}
              />
              <span className="text-foreground">{item.label}</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'text-sm font-semibold',
                  item.tone === 'destructive' && 'text-destructive',
                  item.tone === 'warning' && 'text-warning',
                  item.tone === 'info' && 'text-foreground',
                  item.tone === 'muted' && 'text-muted-foreground',
                )}
              >
                {item.value}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            </span>
          </Link>
        ))}

        <div className="mt-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link to={ROUTES.app.terminal.overview}>Open terminal</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}