import { Link } from 'react-router-dom';
import { ExternalLink, MoreVertical, PauseCircle, RefreshCw, Trash2 } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../../../components/ui/Dropdown.jsx';
import { SourceStatusBadge } from '../../../components/domain/source/SourceStatusBadge.jsx';
import { SourceHealthBadge } from '../../../components/domain/source/SourceHealthBadge.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function SourceCard({ source, onPause, onRevalidate, onRemove, className }) {
  if (!source) {
    return null;
  }

  const linkTo = ROUTES.app.sources.details(source.id);

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <Link to={linkTo} className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              {(source.platform ?? 'S').slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{source.name}</p>
              <SourceStatusBadge status={source.status} />
            </div>
            <p className="mt-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
              {source.platform} · {source.category ?? 'uncategorized'}
            </p>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton label="Source actions" size="sm">
              <MoreVertical className="h-4 w-4" />
            </IconButton>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem asChild>
              <Link to={linkTo}>View details</Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link to={ROUTES.app.sources.connection(source.id)}>Connection</Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link to={ROUTES.app.sources.sandbox(source.id)}>Sandbox test</Link>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={() => onRevalidate?.(source)}>
              <RefreshCw className="h-3.5 w-3.5" /> Revalidate
            </DropdownItem>
            <DropdownItem
              onSelect={() => onPause?.(source)}
              className="text-warning focus:text-warning"
            >
              <PauseCircle className="h-3.5 w-3.5" /> Pause
            </DropdownItem>
            <DropdownItem
              onSelect={() => onRemove?.(source)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      <Link to={linkTo} className="block border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <SourceHealthBadge status={source.healthState} />
          {source.language ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {source.language}
            </span>
          ) : null}
          {source.messageCount !== undefined ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {source.messageCount.toLocaleString()} messages
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between text-2xs text-muted-foreground">
          <span>
            {source.lastEventAt
              ? `Last event ${formatRelativeTime(source.lastEventAt)}`
              : 'No recent events'}
          </span>
          <span className="flex items-center gap-2">
            {source.workspaceName ? <span>{source.workspaceName}</span> : null}
            {source.type === 'telegram' ? (
              <span className="font-medium text-primary">View messages &amp; signals</span>
            ) : null}
          </span>
        </div>
      </Link>
    </Card>
  );
}