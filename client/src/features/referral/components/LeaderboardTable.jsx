import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function LeaderboardTable({ entries = [], currency = 'USD', className }) {
  if (entries.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Leaderboard data will appear once qualifying referrals accumulate.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {entries.map((entry, index) => {
            const rank = index + 1;
            const isTopThree = rank <= 3;
            const initials = (entry.displayName ?? '?')
              .split(' ')
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <li
                key={entry.userId ?? entry.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold',
                      isTopThree
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {rank}
                  </span>
                  <Avatar size="sm" fallback={initials} src={entry.avatarUrl} />
                  <p className="truncate text-sm font-medium text-foreground">
                    {entry.displayName ?? `Affiliate ${rank}`}
                  </p>
                  {entry.badge ? (
                    <Badge variant="info" size="sm">
                      {entry.badge}
                    </Badge>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {formatCurrency(entry.earnings ?? 0, currency)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}