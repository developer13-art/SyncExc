import { Link } from 'react-router-dom';
import { ArrowUpRight, Lock, Users } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

const VISIBILITY_LABELS = {
  public: { label: 'Public', variant: 'muted' },
  private: { label: 'Private', variant: 'warning' },
  approval_required: { label: 'Approval required', variant: 'info' },
};

export function GroupCard({ group, className }) {
  if (!group) {
    return null;
  }

  const linkTo = ROUTES.app.community.group(group.id);
  const visibility = VISIBILITY_LABELS[group.visibility] ?? VISIBILITY_LABELS.public;

  return (
    <Card className={cn('overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md', className)}>
      <Link to={linkTo} className="group block">
        <div className="relative flex h-24 items-center justify-center overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-muted">
          {group.coverUrl || group.coverImageUrl ? (
            <img
              src={group.coverUrl ?? group.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <span className="absolute -right-4 -top-8 h-28 w-28 rounded-full border border-primary/20" />
              <span className="absolute -bottom-12 -left-2 h-32 w-32 rounded-full border border-primary/20" />
              <Users className="relative h-9 w-9 text-primary/80" />
            </>
          )}
          <Badge variant={visibility.variant} className="absolute right-3 top-3 bg-card/90">
            {group.visibility === 'private' ? <Lock className="mr-1 h-3 w-3" /> : null}
            {visibility.label}
          </Badge>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                {group.name}
              </p>
              {group.slug ? (
                <p className="text-2xs text-muted-foreground">/{group.slug}</p>
              ) : null}
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
          </div>

          {group.description ? (
            <p className="mt-2 line-clamp-2 min-h-8 text-xs text-muted-foreground">
              {group.description}
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-3 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {group.memberCount?.toLocaleString() ?? 0} member
              {(group.memberCount ?? 0) !== 1 ? 's' : ''}
            </span>
            {group.postCount !== undefined ? (
              <span>
                {group.postCount.toLocaleString()} post
                {group.postCount !== 1 ? 's' : ''}
              </span>
            ) : null}
          </div>

          {group.topics?.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              {group.topics.slice(0, 3).map((topic) => (
                <Badge key={topic} variant="muted" size="sm">
                  #{topic}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </Card>
  );
}