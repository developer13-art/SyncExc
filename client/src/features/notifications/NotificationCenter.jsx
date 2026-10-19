import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { NotificationList } from './components/NotificationList.jsx';
import { NotificationFilters } from './components/NotificationFilters.jsx';
import { useNotifications, useUnreadCount } from '../../hooks/useNotifications.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function NotificationCenter() {
  const dispatch = useDispatch();
  const toast = useToast();
  const pagination = usePagination({ initialPageSize: 25 });

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');

  const notificationsQuery = useNotifications({
    status: status === 'all' ? undefined : status,
    category: category === 'all' ? undefined : category,
    q: query || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const { unreadCount } = useUnreadCount();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Notifications'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Notifications', path: ROUTES.app.notifications.overview },
      ]),
    );
  }, [dispatch]);

  useEffect(() => {
    const total = notificationsQuery.meta?.total;
    if (total !== undefined) {
      pagination.setTotal(total);
    }
  }, [notificationsQuery.meta?.total, pagination.setTotal]);

  const notifications = notificationsQuery.notifications ?? [];

  const handleMarkAllRead = async () => {
    try {
      await notificationsQuery.markAllRead();
      toast.success('All notifications marked read');
      await notificationsQuery.refetch?.();
    } catch (err) {
      toast.error('Action failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'You are all caught up.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.notifications.preferences}>
              <Settings className="h-4 w-4" /> Preferences
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.notifications.devices}>Devices</Link>
          </Button>
        </div>
      </div>

      <NotificationFilters
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        category={category}
        onCategoryChange={setCategory}
        onMarkAllRead={handleMarkAllRead}
        unreadCount={unreadCount ?? 0}
        isMarkingAllRead={false}
      />

      <Card>
        <CardContent className="p-0">
          <NotificationList
            notifications={notifications}
            isLoading={notificationsQuery.isLoading}
            onMarkRead={notificationsQuery.markRead}
            onArchive={notificationsQuery.archive}
            emptyTitle="No notifications"
            emptyDescription="Notifications will appear here as events occur."
          />
        </CardContent>
      </Card>

      {pagination.total > pagination.pageSize ? (
        <div className="flex justify-end">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={pagination.goToPage}
            hasNext={pagination.hasNext}
            hasPrev={pagination.hasPrev}
          />
        </div>
      ) : null}
    </div>
  );
}