import { Link } from 'react-router-dom';
import { Lock, Users } from 'lucide-react';

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
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
            {group.slug ? (
              <p className="text-2xs text-muted-foreground">/{group.slug}</p>
            ) : null}
          </div>
          <Badge variant={visibility.variant}>
            {group.visibility === 'private' ? (
              <Lock className="mr-1 h-3 w-3" />
            ) : null}
            {visibility.label}
          </Badge>
        </div>

        {group.description ? (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
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
            {group.topics.slice(0, 4).map((topic) => (
              <Badge key={topic} variant="muted" size="sm">
                #{topic}
              </Badge>
            ))}
          </div>
        ) : null}
      </Link>
    </Card>
  );
}