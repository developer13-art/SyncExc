import * as Popover from '@radix-ui/react-popover';
import { Link } from 'react-router-dom';
import { Bell, Check, Inbox } from 'lucide-react';
import { useMemo } from 'react';

import { cn } from '../../lib/utils/cn.util.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { useNotificationContext } from '../../context/NotificationContext.jsx';
import { useNotifications } from '../../hooks/useNotifications.js';
import { ROUTES } from '../../config/routes.config.js';

export function NotificationsMenu() {
  const { unreadCount, markAllRead } = useNotificationContext();
  const { notifications, isLoading, markRead } = useNotifications({ limit: 10 });

  const top = useMemo(() => notifications.slice(0, 10), [notifications]);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-semibold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-96 overflow-hidden rounded-md border border-border bg-popover shadow-md"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-4">
                <div className="h-12 animate-pulse rounded-md bg-muted" />
                <div className="h-12 animate-pulse rounded-md bg-muted" />
                <div className="h-12 animate-pulse rounded-md bg-muted" />
              </div>
            ) : top.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Inbox className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {top.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => markRead(notification.id)}
                      className={cn(
                        'flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-muted/60',
                        !notification.read && 'bg-primary/5',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          {notification.title}
                        </p>
                        {!notification.read ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        ) : null}
                      </div>
                      {notification.body ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {notification.body}
                        </p>
                      ) : null}
                      <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to={ROUTES.app.notifications.overview}
            className="block border-t border-border px-4 py-3 text-center text-sm text-primary hover:bg-muted"
          >
            View all notifications
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}