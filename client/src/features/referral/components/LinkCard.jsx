import { ExternalLink, Link2, MoreVertical, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { CopyButton } from '../../../components/ui/CopyButton.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../../../components/ui/Dropdown.jsx';

export function LinkCard({ link, onPause, onResume, onRevoke, className }) {
  if (!link) {
    return null;
  }

  const url = link.url ?? `https://syncexc.com/register?ref=${link.code}`;
  const isActive = link.status === 'active';
  const isPaused = link.status === 'paused';

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-medium text-foreground">
              {link.name ?? link.code}
            </p>
            <Badge
              variant={isActive ? 'success' : isPaused ? 'warning' : 'muted'}
            >
              {link.status ?? 'active'}
            </Badge>
          </div>

          {link.campaignName ? (
            <p className="mt-1 text-2xs uppercase tracking-wide text-muted-foreground">
              Campaign: {link.campaignName}
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-2xs text-foreground">
              {url}
            </code>
            <CopyButton value={url} />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition hover:text-foreground"
              aria-label="Open link"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton label="Link actions" size="sm">
              <MoreVertical className="h-4 w-4" />
            </IconButton>
          </DropdownTrigger>
          <DropdownContent align="end">
            {isActive ? (
              <DropdownItem onSelect={() => onPause?.(link)}>
                <PauseCircle className="h-3.5 w-3.5" /> Pause link
              </DropdownItem>
            ) : isPaused ? (
              <DropdownItem onSelect={() => onResume?.(link)}>
                <PlayCircle className="h-3.5 w-3.5" /> Resume link
              </DropdownItem>
            ) : null}
            <DropdownSeparator />
            <DropdownItem
              onSelect={() => onRevoke?.(link)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Revoke
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border p-4 text-xs">
        <Metric label="Clicks" value={link.clicks ?? 0} />
        <Metric label="Registrations" value={link.registrations ?? 0} />
        <Metric label="Conversions" value={link.conversions ?? 0} />
      </div>
    </Card>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}