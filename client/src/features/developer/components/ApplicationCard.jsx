import { Link } from 'react-router-dom';
import { KeyRound, MoreVertical, Webhook } from 'lucide-react';

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

const STATUS_VARIANTS = {
  active: 'success',
  draft: 'muted',
  restricted: 'warning',
  suspended: 'destructive',
  revoked: 'destructive',
  archived: 'muted',
};

const TYPE_LABELS = {
  personal: 'Personal integration',
  organization: 'Organization integration',
  third_party: 'Approved third-party product',
};

export function ApplicationCard({ application, className }) {
  if (!application) {
    return null;
  }

  const linkTo = ROUTES.app.developer.application(application.id);
  const statusVariant = STATUS_VARIANTS[application.status] ?? 'muted';

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        <Link to={linkTo} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {application.name}
            </p>
            <Badge variant={statusVariant}>{application.status ?? 'draft'}</Badge>
          </div>
          {application.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {application.description}
            </p>
          ) : null}
          <p className="mt-1 text-2xs uppercase tracking-wide text-muted-foreground">
            {TYPE_LABELS[application.type] ?? application.type ?? 'integration'}
            {application.environment ? ` · ${application.environment}` : ''}
          </p>
        </Link>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton label="Application actions" size="sm">
              <MoreVertical className="h-4 w-4" />
            </IconButton>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem asChild>
              <Link to={linkTo}>View application</Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link to={ROUTES.app.developer.credentials(application.id)}>
                Manage credentials
              </Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link to={ROUTES.app.developer.webhooks(application.id)}>
                Manage webhooks
              </Link>
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem asChild>
              <Link to={ROUTES.app.developer.sandbox(application.id)}>Sandbox</Link>
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      <Link to={linkTo} className="block border-t border-border px-4 py-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <KeyRound className="h-3 w-3" />
            {application.credentialCount ?? 0} credential
            {(application.credentialCount ?? 0) !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Webhook className="h-3 w-3" />
            {application.webhookCount ?? 0} webhook
            {(application.webhookCount ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="mt-2 text-2xs text-muted-foreground">
          {application.lastActivityAt
            ? `Last activity ${formatRelativeTime(application.lastActivityAt)}`
            : 'No recent activity'}
        </p>
      </Link>
    </Card>
  );
}