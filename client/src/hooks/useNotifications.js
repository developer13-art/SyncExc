import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useNotifications(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => notificationsApi.list(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (notificationId) =>
      notificationsApi.update(notificationId, { read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const archive = useMutation({
    mutationFn: (notificationId) => notificationsApi.archive(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const dismiss = useMutation({
    mutationFn: (notificationId) => notificationsApi.dismiss(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return {
    notifications: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
    archive: archive.mutateAsync,
    dismiss: dismiss.mutateAsync,
  };
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => notificationsApi.getUnreadCount(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useNotificationPreferences() {
  const queryClient = useQueryClient();

  const preferencesQuery = useQuery({
    queryKey: queryKeys.notifications.preferences,
    queryFn: () => notificationsApi.getPreferences(),
    staleTime: 60_000,
  });

  const quietHoursQuery = useQuery({
    queryKey: queryKeys.notifications.quietHours,
    queryFn: () => notificationsApi.getQuietHours(),
    staleTime: 60_000,
  });

  const update = useMutation({
    mutationFn: (payload) => notificationsApi.updatePreferences(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences }),
  });

  const updateQuietHours = useMutation({
    mutationFn: (payload) => notificationsApi.updateQuietHours(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.quietHours }),
  });

  return {
    preferences: preferencesQuery.data ?? {},
    quietHours: quietHoursQuery.data ?? null,
    isLoading: preferencesQuery.isLoading,
    updatePreferences: update.mutateAsync,
    updateQuietHours: updateQuietHours.mutateAsync,
  };
}

export function useNotificationDevices() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.notifications.devices,
    queryFn: () => notificationsApi.listDevices(),
    staleTime: 60_000,
  });

  const register = useMutation({
    mutationFn: (payload) => notificationsApi.registerDevice(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.devices }),
  });

  const remove = useMutation({
    mutationFn: (deviceId) => notificationsApi.removeDevice(deviceId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.devices }),
  });

  return {
    devices: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    registerDevice: register.mutateAsync,
    removeDevice: remove.mutateAsync,
  };
}