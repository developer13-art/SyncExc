import { Link } from 'react-router-dom';
import { Building2, Clock } from 'lucide-react';

import { Card } from '../../ui/Card.jsx';
import { ConnectionStatusBadge } from './ConnectionStatusBadge.jsx';
import { ConnectionHealthBadge } from './ConnectionHealthBadge.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function ConnectionCard({ connection, href, className }) {
  if (!connection) {
    return null;
  }

  const linkTo = href ?? ROUTES.app.connections.details(connection.id);

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {connection.label ?? connection.exchangeName}
              </p>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                {connection.exchangeName} · {connection.environment ?? 'production'}
              </p>
            </div>
          </div>
          <ConnectionStatusBadge status={connection.status} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <ConnectionHealthBadge status={connection.health?.status} />
          {connection.accountCount !== undefined ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {connection.accountCount} account{connection.accountCount !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {connection.lastSyncedAt
              ? `Synced ${formatRelativeTime(connection.lastSyncedAt)}`
              : 'Never synced'}
          </span>
          {connection.ownerWorkspaceName ? (
            <span className="truncate">{connection.ownerWorkspaceName}</span>
          ) : null}
        </div>
      </Link>
    </Card>
  );
}