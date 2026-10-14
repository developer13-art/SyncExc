import { Link } from 'react-router-dom';
import { Star, Users } from 'lucide-react';

import { Card } from '../../ui/Card.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function ProviderCard({ provider, href, className }) {
  if (!provider) {
    return null;
  }

  const linkTo = href ?? ROUTES.app.marketplace.provider(provider.id);
  const initials = (provider.displayName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start gap-3">
          <Avatar src={provider.avatarUrl} fallback={initials} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {provider.displayName}
              </p>
              {provider.verified ? (
                <Badge variant="info" size="sm">
                  Verified
                </Badge>
              ) : null}
            </div>
            {provider.handle ? (
              <p className="text-xs text-muted-foreground">@{provider.handle}</p>
            ) : null}
          </div>
        </div>

        {provider.bio ? (
          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{provider.bio}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {provider.subscriberCount !== undefined ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3" />
              {provider.subscriberCount.toLocaleString()} subscribers
            </span>
          ) : null}
          {provider.rating !== undefined ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Star className="h-3 w-3" />
              {provider.rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        {provider.markets?.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
            {provider.markets.slice(0, 4).map((market) => (
              <span
                key={market}
                className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground"
              >
                {market}
              </span>
            ))}
          </div>
        ) : null}
      </Link>
    </Card>
  );
}