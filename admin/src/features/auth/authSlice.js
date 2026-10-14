import { createSlice } from '@reduxjs/toolkit';

import { STORAGE_KEYS, storage } from '../../lib/utils/storage.util.js';

function loadPersistedSession() {
  const token = storage.get(STORAGE_KEYS.AUTH_TOKEN, null, { parse: false });
  const refreshToken = storage.get(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`, null, {
    parse: false,
  });
  const admin = storage.get(STORAGE_KEYS.AUTH_ADMIN);
  return { token, refreshToken, admin };
}

const persisted = loadPersistedSession();

const initialState = {
  admin: persisted.admin ?? null,
  accessToken: persisted.token ?? null,
  refreshToken: persisted.refreshToken ?? null,
  isAuthenticated: Boolean(persisted.token && persisted.admin),
  isBootstrapping: Boolean(persisted.token && !persisted.admin),
  mfaChallenge: null,
  stepUpRequired: false,
  lastActivityAt: null,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    bootstrapping(state) {
      state.isBootstrapping = true;
    },
    bootstrappingComplete(state) {
      state.isBootstrapping = false;
    },
    loginSucceeded(state, action) {
      const { admin, accessToken, refreshToken } = action.payload;
      state.admin = admin;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken ?? state.refreshToken;
      state.isAuthenticated = true;
      state.isBootstrapping = false;
      state.error = null;
      state.lastActivityAt = Date.now();

      storage.set(STORAGE_KEYS.AUTH_TOKEN, accessToken, { stringify: false });
      if (refreshToken) {
        storage.set(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`, refreshToken, {
          stringify: false,
        });
      }
      storage.set(STORAGE_KEYS.AUTH_ADMIN, admin);
    },
    mfaChallengeRequired(state, action) {
      state.mfaChallenge = action.payload;
      state.error = null;
    },
    mfaChallengeCleared(state) {
      state.mfaChallenge = null;
    },
    tokenRefreshed(state, action) {
      const { accessToken, refreshToken } = action.payload;
      state.accessToken = accessToken;
      state.lastActivityAt = Date.now();
      storage.set(STORAGE_KEYS.AUTH_TOKEN, accessToken, { stringify: false });
      if (refreshToken) {
        state.refreshToken = refreshToken;
        storage.set(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`, refreshToken, {
          stringify: false,
        });
      }
    },
    adminUpdated(state, action) {
      state.admin = { ...state.admin, ...action.payload };
      storage.set(STORAGE_KEYS.AUTH_ADMIN, state.admin);
    },
    stepUpRequired(state) {
      state.stepUpRequired = true;
    },
    stepUpCleared(state) {
      state.stepUpRequired = false;
    },
    logoutFulfilled(state) {
      state.admin = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isBootstrapping = false;
      state.mfaChallenge = null;
      state.stepUpRequired = false;
      state.error = null;

      storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      storage.remove(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`);
      storage.remove(STORAGE_KEYS.AUTH_ADMIN);
    },
    sessionExpired(state) {
      state.admin = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isBootstrapping = false;
      state.error = 'SESSION_EXPIRED';

      storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      storage.remove(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`);
      storage.remove(STORAGE_KEYS.AUTH_ADMIN);
    },
    activityPing(state) {
      state.lastActivityAt = Date.now();
    },
  },
});

export const authActions = authSlice.actions;
export const authReducer = authSlice.reducer;

export const selectCurrentAdmin = (state) => state.auth.admin;
export const selectAccessToken = (state) => state.auth.accessToken;
export const selectRefreshToken = (state) => state.auth.refreshToken;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsBootstrapping = (state) => state.auth.isBootstrapping;
export const selectMfaChallenge = (state) => state.auth.mfaChallenge;
export const selectStepUpRequired = (state) => state.auth.stepUpRequired;
export const selectAuthError = (state) => state.auth.error;

export default authSlice.reducer;