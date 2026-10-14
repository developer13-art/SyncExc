import { Link } from 'react-router-dom';
import { Building2, Clock, MoreVertical, Settings2, Trash2, PauseCircle } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../../../components/ui/Dropdown.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import { ConnectionStatusBadge } from '../../../components/domain/connection/ConnectionStatusBadge.jsx';
import { ConnectionHealthBadge } from '../../../components/domain/connection/ConnectionHealthBadge.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function ConnectionCard({ connection, onSuspend, onDisconnect, className }) {
  if (!connection) {
    return null;
  }

  const linkTo = ROUTES.app.connections.details(connection.id);

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <Link to={linkTo} className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {connection.label ?? connection.exchangeName}
              </p>
              <ConnectionStatusBadge status={connection.status} />
            </div>
            <p className="mt-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
              {connection.exchangeName}
              {connection.environment ? ` · ${connection.environment}` : ''}
            </p>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton label="Connection actions" size="sm">
              <MoreVertical className="h-4 w-4" />
            </IconButton>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem asChild>
              <Link to={ROUTES.app.connections.details(connection.id)}>
                <Settings2 className="h-3.5 w-3.5" /> Manage
              </Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link to={ROUTES.app.connections.rotate(connection.id)}>Rotate credentials</Link>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              onSelect={() => onSuspend?.(connection)}
              className="text-warning focus:text-warning"
            >
              <PauseCircle className="h-3.5 w-3.5" /> Suspend
            </DropdownItem>
            <DropdownItem
              onSelect={() => onDisconnect?.(connection)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Disconnect
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      <Link to={linkTo} className="block border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ConnectionHealthBadge status={connection.health?.status} />
          {connection.accountCount !== undefined ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {connection.accountCount} account{connection.accountCount !== 1 ? 's' : ''}
            </span>
          ) : null}
          {connection.capabilities?.spotTrading === 'verified' ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              Spot enabled
            </span>
          ) : null}
          {connection.capabilities?.derivativesTrading === 'verified' ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              Derivatives enabled
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between text-2xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {connection.lastSyncedAt
              ? `Synced ${formatRelativeTime(connection.lastSyncedAt)}`
              : 'Never synced'}
          </span>
          {connection.ownerWorkspaceName ? <span>{connection.ownerWorkspaceName}</span> : null}
        </div>
      </Link>
    </Card>
  );
}