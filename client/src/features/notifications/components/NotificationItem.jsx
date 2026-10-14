import { Check, X, ExternalLink } from 'lucide-react';

import { IconButton } from '../../../components/ui/IconButton.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

const SEVERITY_STYLES = {
  critical: { dot: 'bg-destructive', text: 'text-destructive', label: 'Critical' },
  high: { dot: 'bg-destructive', text: 'text-destructive', label: 'High' },
  warning: { dot: 'bg-warning', text: 'text-warning', label: 'Warning' },
  info: { dot: 'bg-info', text: 'text-info', label: 'Info' },
  success: { dot: 'bg-success', text: 'text-success', label: 'Success' },
  low: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Low' },
};

export function NotificationItem({
  notification,
  onMarkRead,
  onArchive,
  onOpen,
  className,
}) {
  if (!notification) {
    return null;
  }

  const severity = SEVERITY_STYLES[notification.severity] ?? SEVERITY_STYLES.info;

  return (
    <div
      className={cn(
        'group flex items-start gap-3 border-b border-border px-5 py-4 transition last:border-0',
        !notification.read && 'bg-primary/5',
        className,
      )}
    >
      <span
        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', severity.dot)}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {notification.title}
            </p>
            {notification.body ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {notification.body}
              </p>
            ) : null}
          </div>
          <Badge variant={severityTone(notification.severity)} size="sm">
            {severity.label}
          </Badge>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-2xs text-muted-foreground">
          <span>
            {notification.createdAt ? formatRelativeTime(notification.createdAt) : ''}
          </span>
          {notification.category ? (
            <span className="uppercase tracking-wide">
              {notification.category.replace(/_/g, ' ')}
            </span>
          ) : null}
        </div>

        {notification.actionUrl ? (
          <a
            href={notification.actionUrl}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
        {!notification.read ? (
          <IconButton
            label="Mark read"
            size="sm"
            onClick={() => onMarkRead?.(notification.id)}
          >
            <Check className="h-3.5 w-3.5" />
          </IconButton>
        ) : null}
        {onArchive ? (
          <IconButton
            label="Archive"
            size="sm"
            onClick={() => onArchive(notification.id)}
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}

function severityTone(severity) {
  if (severity === 'critical' || severity === 'high') {
    return 'destructive';
  }
  if (severity === 'warning') {
    return 'warning';
  }
  if (severity === 'success') {
    return 'success';
  }
  if (severity === 'low') {
    return 'muted';
  }
  return 'info';
}