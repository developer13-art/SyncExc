import { ExternalLink, Link2 } from 'lucide-react';

import { Card } from '../../ui/Card.jsx';
import { CopyButton } from '../../ui/CopyButton.jsx';
import { Badge } from '../../ui/Badge.jsx';

export function ReferralLinkCard({ link, className }) {
  if (!link) {
    return null;
  }

  const url = link.url ?? `https://syncexc.com/register?ref=${link.code}`;

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-medium text-foreground">
              {link.name ?? link.code}
            </p>
            <Badge variant={link.status === 'active' ? 'success' : 'muted'}>
              {link.status ?? 'active'}
            </Badge>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="truncate rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground">
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
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border p-4 text-xs">
        <div>
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">Clicks</p>
          <p className="mt-0.5 font-semibold text-foreground">{link.clicks ?? 0}</p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">Signups</p>
          <p className="mt-0.5 font-semibold text-foreground">{link.registrations ?? 0}</p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">Converted</p>
          <p className="mt-0.5 font-semibold text-foreground">{link.conversions ?? 0}</p>
        </div>
      </div>
    </Card>
  );
}