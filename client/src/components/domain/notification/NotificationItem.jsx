import { Check, X } from 'lucide-react';

import { IconButton } from '../../ui/IconButton.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

const SEVERITY_ICONS = {
  info: 'text-info',
  warning: 'text-warning',
  critical: 'text-destructive',
  success: 'text-success',
};

export function NotificationItem({ notification, onMarkRead, onArchive, className }) {
  if (!notification) {
    return null;
  }

  const tone = SEVERITY_ICONS[notification.severity] ?? 'text-muted-foreground';

  return (
    <div
      className={cn(
        'group flex items-start gap-3 border-b border-border px-4 py-3 transition last:border-0',
        !notification.read && 'bg-primary/5',
        className,
      )}
    >
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full bg-current', tone)} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        {notification.body ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {notification.body}
          </p>
        ) : null}
        <p className="mt-1 text-2xs text-muted-foreground">
          {formatRelativeTime(notification.createdAt)}
        </p>
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