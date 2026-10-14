import { configureStore, combineReducers } from '@reduxjs/toolkit';

import { authReducer } from '../features/auth/authSlice.js';
import { uiReducer } from './slices/uiSlice.js';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
});

const createRootReducer = (state, action) => {
  if (action.type === 'auth/logout/fulfilled' || action.type === 'auth/sessionExpired') {
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
      },
    }),
  devTools: import.meta.env.DEV,
});

export const dispatch = store.dispatch;
export const getState = store.getState;