import { Link } from 'react-router-dom';
import { ArrowRight, Repeat } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { formatPercent } from '../../../lib/formatters/percent.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function SyncGroupCard({ group, className }) {
  if (!group) {
    return null;
  }

  const linkTo = ROUTES.app.synchronization.group(group.id);
  const isActive = group.status === 'active';
  const isPaused = group.status === 'paused';

  const statusVariant = isActive ? 'success' : isPaused ? 'warning' : 'muted';
  const statusLabel = isActive ? 'Active' : isPaused ? 'Paused' : (group.status ?? 'Inactive');

  const successRate =
    typeof group.successRate === 'number' ? group.successRate : undefined;

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Repeat className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
          </div>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>

        {group.source ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="truncate rounded-md border border-border bg-muted/30 px-2 py-0.5 text-foreground">
              {group.source.exchangeName ?? group.source.label ?? 'Source'}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate rounded-md border border-border bg-muted/30 px-2 py-0.5 text-foreground">
              {group.destinationCount ?? 0} destination
              {(group.destinationCount ?? 0) !== 1 ? 's' : ''}
            </span>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Operations</p>
            <p className="mt-0.5 font-medium text-foreground">{group.operationCount ?? 0}</p>
          </div>
          {successRate !== undefined ? (
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Success</p>
              <p
                className={cn(
                  'mt-0.5 font-medium',
                  successRate >= 0.95
                    ? 'text-success'
                    : successRate >= 0.8
                      ? 'text-warning'
                      : 'text-destructive',
                )}
              >
                {formatPercent(successRate, { decimals: 1, already100: true })}
              </p>
            </div>
          ) : null}
          {group.pendingRetries !== undefined ? (
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Retries</p>
              <p
                className={cn(
                  'mt-0.5 font-medium',
                  group.pendingRetries > 0 ? 'text-warning' : 'text-foreground',
                )}
              >
                {group.pendingRetries}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-3 border-t border-border pt-2.5 text-2xs text-muted-foreground">
          {group.lastActivityAt
            ? `Last activity ${formatRelativeTime(group.lastActivityAt)}`
            : 'No recent activity'}
        </div>
      </Link>
    </Card>
  );
}