import { Link } from 'react-router-dom';
import { Star, Users } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function ProviderCard({ provider, className }) {
  if (!provider) {
    return null;
  }

  const linkTo = ROUTES.app.marketplace.provider(provider.id);
  const initials = (provider.displayName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-5">
        <div className="flex items-start gap-3">
          <Avatar src={provider.avatarUrl} fallback={initials} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {provider.displayName}
              </p>
              {provider.verified ? (
                <Badge variant="info" size="sm">
                  Verified
                </Badge>
              ) : null}
              {provider.status === 'paused' ? (
                <Badge variant="warning" size="sm">
                  Paused
                </Badge>
              ) : null}
            </div>
            {provider.handle ? (
              <p className="mt-0.5 text-xs text-muted-foreground">@{provider.handle}</p>
            ) : null}
          </div>
        </div>

        {(provider.biography || provider.bio) ? (
          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
            {provider.biography || provider.bio}
          </p>
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
          {provider.signalCount !== undefined ? (
            <span className="text-muted-foreground">
              {provider.signalCount.toLocaleString()} signals
            </span>
          ) : null}
        </div>

        {(provider.supportedMarkets || provider.markets)?.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {(provider.supportedMarkets || provider.markets).slice(0, 4).map((market) => (
              <span
                key={market}
                className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground"
              >
                {market}
              </span>
            ))}
            {(provider.supportedMarkets || provider.markets).length > 4 ? (
              <span className="text-2xs text-muted-foreground">
                +{(provider.supportedMarkets || provider.markets).length - 4}
              </span>
            ) : null}
          </div>
        ) : null}
      </Link>
    </Card>
  );
}