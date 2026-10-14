import { Lightbulb, X } from 'lucide-react';

import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';

export function RecommendationCard({ recommendation, onAction, onDismiss, actionLabel = 'Follow' }) {
  if (!recommendation) {
    return null;
  }

  const initials = (recommendation.displayName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar size="md" src={recommendation.avatarUrl} fallback={initials} />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {recommendation.displayName}
            </p>
            {recommendation.handle ? (
              <p className="text-2xs text-muted-foreground">
                @{recommendation.handle}
              </p>
            ) : null}
            {recommendation.bio ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                {recommendation.bio}
              </p>
            ) : null}

            {recommendation.reason ? (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-info/30 bg-info/5 px-2.5 py-1.5">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-info" />
                <p className="text-2xs text-muted-foreground">
                  {recommendation.reason}
                </p>
              </div>
            ) : null}

            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => onAction?.(recommendation)}>
                {actionLabel}
              </Button>
              {onDismiss ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDismiss(recommendation)}
                >
                  Dismiss
                </Button>
              ) : null}
            </div>
          </div>

          {onDismiss ? (
            <IconButton label="Dismiss" size="sm" onClick={() => onDismiss(recommendation)}>
              <X className="h-3.5 w-3.5" />
            </IconButton>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}