import { createSlice } from '@reduxjs/toolkit';

const MAX_BUFFERED = 100;

const initialState = {
  unreadCount: 0,
  recent: [],
  toasts: [],
  lastFetchedAt: null,
  wsConnected: false,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    unreadCountLoaded(state, action) {
      state.unreadCount = action.payload;
      state.lastFetchedAt = Date.now();
    },
    notificationReceived(state, action) {
      const notification = action.payload;
      state.recent = [notification, ...state.recent].slice(0, MAX_BUFFERED);
      if (!notification.read) {
        state.unreadCount = state.unreadCount + 1;
      }
    },
    notificationRead(state, action) {
      const id = action.payload;
      state.recent = state.recent.map((n) => (n.id === id ? { ...n, read: true } : n));
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    },
    notificationArchived(state, action) {
      const id = action.payload;
      const target = state.recent.find((n) => n.id === id);
      if (target && !target.read) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
      state.recent = state.recent.filter((n) => n.id !== id);
    },
    allMarkedRead(state) {
      state.recent = state.recent.map((n) => ({ ...n, read: true }));
      state.unreadCount = 0;
    },
    toastPushed(state, action) {
      state.toasts.push(action.payload);
    },
    toastDismissed(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    wsConnected(state) {
      state.wsConnected = true;
    },
    wsDisconnected(state) {
      state.wsConnected = false;
    },
    reset(state) {
      state.unreadCount = 0;
      state.recent = [];
      state.toasts = [];
      state.wsConnected = false;
    },
  },
});

export const notificationsActions = notificationsSlice.actions;
export const notificationsReducer = notificationsSlice.reducer;

export const selectUnreadCount = (state) => state.notifications.unreadCount;
export const selectRecentNotifications = (state) => state.notifications.recent;
export const selectWsConnected = (state) => state.notifications.wsConnected;

export default notificationsSlice.reducer;