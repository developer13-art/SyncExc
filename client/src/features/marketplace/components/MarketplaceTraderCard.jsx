import { useState } from 'react';
import { Check, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { ROUTES } from '../../../config/routes.config.js';
import { formatPercent } from '../../../lib/formatters/percent.formatter.js';

export function MarketplaceTraderCard({
  provider,
  winRate,
  isFollowing = false,
  onFollow,
  onUnfollow,
}) {
  const [busy, setBusy] = useState(false);
  const initials = provider.displayName?.slice(0, 1)?.toUpperCase() || 'T';

  const toggleFollow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await (isFollowing ? onUnfollow?.(provider.id) : onFollow?.(provider.id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="flex h-full flex-col gap-4 p-4 pt-4 sm:p-5 sm:pt-5">
        <div className="flex items-start gap-3">
          <Avatar src={provider.avatarUrl} fallback={initials} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to={ROUTES.app.marketplace.provider(provider.id)}
                className="truncate font-semibold text-foreground hover:text-primary"
              >
                {provider.displayName}
              </Link>
              {provider.moderationState === 'approved' ? (
                <Badge variant="success" className="gap-1">
                  <Check className="h-3 w-3" /> Verified
                </Badge>
              ) : null}
            </div>
            {provider.handle ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">@{provider.handle}</p>
            ) : null}
          </div>
        </div>

        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {provider.biography || 'Trader profile'}
        </p>

        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3">
          <Metric label="Win rate" value={winRate == null ? '—' : formatPercent(winRate, { already100: true, decimals: 1 })} />
          <Metric label="Signals" value={Number(provider.signalCount || 0).toLocaleString()} />
          <Metric
            label="Followers"
            value={Number(provider.followerCount || 0).toLocaleString()}
            icon={<Users className="mr-1 inline h-3 w-3" />}
          />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <Button
            type="button"
            size="sm"
            variant={isFollowing ? 'outline' : 'default'}
            disabled={busy}
            onClick={toggleFollow}
          >
            {busy ? 'Saving…' : isFollowing ? 'Following' : 'Follow'}
          </Button>
          <Link
            to={ROUTES.app.marketplace.provider(provider.id)}
            className="text-sm font-medium text-primary hover:underline"
          >
            View profile
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">
        {icon}{value}
      </p>
    </div>
  );
}
