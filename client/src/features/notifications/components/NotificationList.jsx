import { Inbox } from 'lucide-react';

import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { NotificationItem } from './NotificationItem.jsx';

export function NotificationList({
  notifications = [],
  isLoading,
  onMarkRead,
  onArchive,
  emptyTitle = 'No notifications',
  emptyDescription = 'You are all caught up.',
}) {
  if (isLoading) {
    return <LoadingState label="Loading notifications" />;
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={emptyTitle}
        description={emptyDescription}
        size="sm"
        className="border-0 bg-transparent py-12"
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {notifications.map((notification) => (
        <li key={notification.id}>
          <NotificationItem
            notification={notification}
            onMarkRead={onMarkRead}
            onArchive={onArchive}
          />
        </li>
      ))}
    </ul>
  );
}