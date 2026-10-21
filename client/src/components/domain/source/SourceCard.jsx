import { Link } from 'react-router-dom';
import { Rss } from 'lucide-react';

import { Card } from '../../ui/Card.jsx';
import { SourceStatusBadge } from './SourceStatusBadge.jsx';
import { SourceHealthBadge } from './SourceHealthBadge.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function SourceCard({ source, href, className }) {
  if (!source) {
    return null;
  }

  const linkTo = href ?? ROUTES.app.sources.details(source.id);

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Rss className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-semibold text-foreground">{source.name}</p>
          </div>
          <SourceStatusBadge status={source.status} />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <SourceHealthBadge status={source.healthState} />
          {source.category ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {source.category}
            </span>
          ) : null}
          {source.platform ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {source.platform}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-2xs text-muted-foreground">
          <span>
            {source.lastEventAt
              ? `Last event ${formatRelativeTime(source.lastEventAt)}`
              : 'No recent events'}
          </span>
          {source.workspaceName ? <span>{source.workspaceName}</span> : null}
        </div>
      </Link>
    </Card>
  );
}