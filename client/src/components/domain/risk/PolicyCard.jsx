import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

import { Card } from '../../ui/Card.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

const MODE_LABELS = {
  block: 'Block',
  require_confirmation: 'Confirm',
  require_approval: 'Approval',
  warn: 'Warn',
  monitor_only: 'Monitor',
};

export function PolicyCard({ policy, href, className }) {
  if (!policy) {
    return null;
  }

  const linkTo = href ?? ROUTES.app.risk.policy(policy.id);

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-semibold text-foreground">{policy.name}</p>
          </div>
          <Badge variant={policy.status === 'active' ? 'success' : 'muted'}>
            {policy.status ?? 'draft'}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
            {MODE_LABELS[policy.enforcementMode] ?? policy.enforcementMode}
          </span>
          <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
            {policy.scopeLevel ?? 'workspace'}
          </span>
          {policy.ruleCount !== undefined ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {policy.ruleCount} rule{policy.ruleCount !== 1 ? 's' : ''}
            </span>
          ) : null}
          {policy.version !== undefined ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              v{policy.version}
            </span>
          ) : null}
        </div>

        {policy.description ? (
          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
            {policy.description}
          </p>
        ) : null}
      </Link>
    </Card>
  );
}