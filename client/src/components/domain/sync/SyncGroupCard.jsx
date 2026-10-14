import { Link } from 'react-router-dom';
import { ArrowRight, Repeat } from 'lucide-react';

import { Card } from '../../ui/Card.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function SyncGroupCard({ group, href, className }) {
  if (!group) {
    return null;
  }

  const linkTo = href ?? ROUTES.app.synchronization.group(group.id);
  const isActive = group.status === 'active';

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Repeat className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
          </div>
          <Badge variant={isActive ? 'success' : 'muted'}>
            {isActive ? 'Active' : (group.status ?? 'Inactive')}
          </Badge>
        </div>

        {group.source && group.destinations ? (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="truncate rounded-md border border-border bg-muted/30 px-2 py-0.5 text-foreground">
              {group.source.exchangeName ?? group.source.label}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate rounded-md border border-border bg-muted/30 px-2 py-0.5 text-foreground">
              {group.destinations.length} destination
              {group.destinations.length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          {group.operationCount !== undefined ? (
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Operations</p>
              <p className="mt-0.5 font-medium text-foreground">{group.operationCount}</p>
            </div>
          ) : null}
          {group.successRate !== undefined ? (
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Success</p>
              <p className="mt-0.5 font-medium text-foreground">
                {(group.successRate * 100).toFixed(1)}%
              </p>
            </div>
          ) : null}
          {group.pendingRetries !== undefined ? (
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Retries</p>
              <p className="mt-0.5 font-medium text-foreground">{group.pendingRetries}</p>
            </div>
          ) : null}
        </div>

        {group.lastActivityAt ? (
          <div className="mt-3 border-t border-border pt-2.5 text-2xs text-muted-foreground">
            Last activity {formatRelativeTime(group.lastActivityAt)}
          </div>
        ) : null}
      </Link>
    </Card>
  );
}