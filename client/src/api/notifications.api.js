import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const notificationsApi = {
  list: (params) => api.getPaged(endpoints.notifications.list, { params }),

  getUnreadCount: () => api.get(endpoints.notifications.unreadCount),

  getById: (notificationId) => api.get(endpoints.notifications.notification(notificationId)),

  update: (notificationId, payload) =>
    api.patch(endpoints.notifications.notification(notificationId), payload),

  markAllRead: () => api.post(endpoints.notifications.markAllRead),

  archive: (notificationId) =>
    api.post(endpoints.notifications.archive(notificationId)),

  dismiss: (notificationId) =>
    api.post(endpoints.notifications.dismiss(notificationId)),

  getCategories: () => api.get(endpoints.notifications.categories),

  getDeliveryStatus: (notificationId) =>
    api.get(endpoints.notifications.deliveryStatus(notificationId)),

  getPreferences: () => api.get(endpoints.notifications.preferences),

  updatePreferences: (payload) => api.patch(endpoints.notifications.preferences, payload),

  getQuietHours: () => api.get(endpoints.notifications.quietHours),

  updateQuietHours: (payload) => api.put(endpoints.notifications.quietHours, payload),

  listDevices: () => api.get(endpoints.notifications.devices),

  registerDevice: (payload) => api.post(endpoints.notifications.devices, payload),

  removeDevice: (deviceId) => api.delete(endpoints.notifications.device(deviceId)),

  testDevice: (deviceId) => api.post(endpoints.notifications.testDevice(deviceId)),
};