import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function MetricTiles({ metrics, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
        Unable to load platform metrics. Please refresh.
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const cards = [
    {
      label: 'Active users',
      value: metrics.activeUsers?.toLocaleString() ?? '—',
      hint:
        metrics.newUsersToday !== undefined
          ? `${metrics.newUsersToday.toLocaleString()} new today`
          : null,
      trend:
        metrics.activeUsersChange !== undefined
          ? formatChange(metrics.activeUsersChange)
          : null,
    },
    {
      label: 'Active subscriptions',
      value: metrics.activeSubscriptions?.toLocaleString() ?? '—',
      hint:
        metrics.trialingSubscriptions !== undefined
          ? `${metrics.trialingSubscriptions} trialing`
          : null,
      tone: metrics.pastDueSubscriptions > 0 ? 'warning' : undefined,
      trend:
        metrics.pastDueSubscriptions > 0
          ? `${metrics.pastDueSubscriptions} past due`
          : null,
    },
    {
      label: 'Workspace count',
      value: metrics.workspaceCount?.toLocaleString() ?? '—',
      hint:
        metrics.organizationWorkspaceCount !== undefined
          ? `${metrics.organizationWorkspaceCount} organization`
          : null,
      trend: null,
    },
    {
      label: 'Connected exchanges',
      value: metrics.connectedExchangeCount?.toLocaleString() ?? '—',
      hint:
        metrics.degradedConnectionCount !== undefined
          ? `${metrics.degradedConnectionCount} degraded`
          : null,
      tone: metrics.degradedConnectionCount > 0 ? 'warning' : undefined,
      trend: null,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          hint={card.hint}
          tone={card.tone}
          trend={
            card.trend ? (
              <span
                className={cn(
                  'font-medium',
                  card.tone === 'warning' && 'text-warning',
                  card.tone !== 'warning' && 'text-muted-foreground',
                )}
              >
                {card.trend}
              </span>
            ) : null
          }
        />
      ))}
    </div>
  );
}

function formatChange(change) {
  if (typeof change !== 'number') {
    return null;
  }
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}% since yesterday`;
}

export function MetricTileChip({ label, value, tone, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-2xs',
        tone === 'warning' && 'border-warning/30 bg-warning/5 text-warning',
        tone === 'destructive' && 'border-destructive/30 bg-destructive/5 text-destructive',
        tone === 'success' && 'border-success/30 bg-success/5 text-success',
        className,
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}

export { Badge };