import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';

import { notificationsApi } from '../api/index.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useToast } from '../hooks/useToast.js';
import {
  notificationsActions,
  selectUnreadCount,
} from '../features/notifications/notificationsSlice.js';
import { selectIsAuthenticated } from '../features/auth/authSlice.js';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const unreadCount = useSelector(selectUnreadCount);

  const ws = useWebSocket({
    channels: ['notifications'],
    autoConnect: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await notificationsApi.getUnreadCount();
        if (!cancelled) {
          dispatch(
            notificationsActions.unreadCountLoaded(
              typeof result === 'number' ? result : (result?.count ?? 0),
            ),
          );
        }
      } catch {
        // Non-critical; the badge will catch up on next action.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, dispatch]);

  useEffect(() => {
    if (!ws.isConnected) {
      dispatch(notificationsActions.wsDisconnected());
      return undefined;
    }

    dispatch(notificationsActions.wsConnected());

    const offNotification = ws.on('notification', (payload) => {
      dispatch(notificationsActions.notificationReceived(payload));
      if (payload?.title) {
        const kind = payload.severity === 'critical' ? 'error' : 'info';
        toast[kind]?.(payload.title, {
          description: payload.body ?? undefined,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    const offUnread = ws.on('notifications.unread', (payload) => {
      dispatch(notificationsActions.unreadCountLoaded(payload?.count ?? 0));
    });

    return () => {
      offNotification?.();
      offUnread?.();
    };
  }, [ws, dispatch, toast, queryClient]);

  const markRead = useCallback(
    async (notificationId) => {
      dispatch(notificationsActions.notificationRead(notificationId));
      try {
        await notificationsApi.update(notificationId, { read: true });
      } catch {
        // Re-sync on next fetch.
      }
    },
    [dispatch],
  );

  const markAllRead = useCallback(async () => {
    dispatch(notificationsActions.allMarkedRead());
    try {
      await notificationsApi.markAllRead();
    } catch {
      // Re-sync on next fetch.
    }
  }, [dispatch]);

  const archive = useCallback(
    async (notificationId) => {
      dispatch(notificationsActions.notificationArchived(notificationId));
      try {
        await notificationsApi.archive(notificationId);
      } catch {
        // Re-sync on next fetch.
      }
    },
    [dispatch],
  );

  const value = useMemo(
    () => ({
      unreadCount,
      wsConnected: ws.isConnected,
      markRead,
      markAllRead,
      archive,
    }),
    [unreadCount, ws.isConnected, markRead, markAllRead, archive],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      'useNotificationContext must be used within a NotificationProvider',
    );
  }
  return ctx;
}