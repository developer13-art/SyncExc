import { Link } from 'react-router-dom';
import { MoreVertical, PauseCircle, PlayCircle, Shield } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../../../components/ui/Dropdown.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

const MODE_LABELS = {
  block: { label: 'Block', variant: 'destructive' },
  require_confirmation: { label: 'Confirm', variant: 'warning' },
  require_approval: { label: 'Approval', variant: 'warning' },
  warn: { label: 'Warn', variant: 'info' },
  monitor_only: { label: 'Monitor', variant: 'muted' },
};

const SCOPE_LABELS = {
  platform: 'Platform',
  workspace: 'Workspace',
  group: 'Sync group',
  account: 'Account',
  instrument: 'Instrument',
  operation: 'Operation',
};

export function PolicyCard({ policy, onActivate, onSuspend, className }) {
  if (!policy) {
    return null;
  }

  const linkTo = ROUTES.app.risk.policy(policy.id);
  const mode = MODE_LABELS[policy.enforcementMode] ?? MODE_LABELS.warn;
  const isActive = policy.status === 'active';

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <Link to={linkTo} className="flex min-w-0 flex-1 items-start gap-3">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{policy.name}</p>
              <Badge variant={isActive ? 'success' : 'muted'}>
                {policy.status ?? 'draft'}
              </Badge>
              <Badge variant={mode.variant}>{mode.label}</Badge>
            </div>
            {policy.description ? (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                {policy.description}
              </p>
            ) : null}
          </div>
        </Link>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton label="Policy actions" size="sm">
              <MoreVertical className="h-4 w-4" />
            </IconButton>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem asChild>
              <Link to={ROUTES.app.risk.policyVersions(policy.id)}>View versions</Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link to={ROUTES.app.risk.policy(policy.id)}>Edit</Link>
            </DropdownItem>
            <DropdownSeparator />
            {isActive ? (
              <DropdownItem
                onSelect={() => onSuspend?.(policy)}
                className="text-warning focus:text-warning"
              >
                <PauseCircle className="h-3.5 w-3.5" /> Suspend
              </DropdownItem>
            ) : (
              <DropdownItem onSelect={() => onActivate?.(policy)}>
                <PlayCircle className="h-3.5 w-3.5" /> Activate
              </DropdownItem>
            )}
          </DropdownContent>
        </DropdownMenu>
      </div>

      <Link to={linkTo} className="block border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
            {SCOPE_LABELS[policy.scopeLevel] ?? policy.scopeLevel ?? 'Workspace'}
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

        {policy.updatedAt ? (
          <p className="mt-2.5 text-2xs text-muted-foreground">
            Updated {formatRelativeTime(policy.updatedAt)}
          </p>
        ) : null}
      </Link>
    </Card>
  );
}