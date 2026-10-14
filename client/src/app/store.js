import { configureStore, combineReducers } from '@reduxjs/toolkit';

import { authReducer } from '../features/auth/authSlice.js';
import { workspaceReducer } from '../features/settings/workspaceSlice.js';
import { uiReducer } from './slices/uiSlice.js';
import { notificationsReducer } from '../features/notifications/notificationsSlice.js';

const rootReducer = combineReducers({
  auth: authReducer,
  workspace: workspaceReducer,
  ui: uiReducer,
  notifications: notificationsReducer,
});

const createRootReducer = (state, action) => {
  if (action.type === 'auth/logout/fulfilled' || action.type === 'auth/sessionExpired') {
    // Preserve UI preferences across logout for a smoother re-login experience.
    const { ui } = state || {};
    state = ui ? { ui } : undefined;
  }
  return rootReducer(state, action);
};

export const store = configureStore({
  reducer: createRootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/sessionExpired'],
        ignoredPaths: ['auth.lastActivityAt'],
      },
    }),
  devTools: import.meta.env.DEV,
});

export const dispatch = store.dispatch;
export const getState = store.getState;