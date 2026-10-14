import { createSlice } from '@reduxjs/toolkit';

import { STORAGE_KEYS, storage } from '../../lib/utils/storage.util.js';

function loadPersistedSession() {
  const token = storage.get(STORAGE_KEYS.AUTH_TOKEN, null, { parse: false });
  const refreshToken = storage.get(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`, null, {
    parse: false,
  });
  const user = storage.get(STORAGE_KEYS.AUTH_USER);
  return { token, refreshToken, user };
}

const persisted = loadPersistedSession();

const initialState = {
  user: persisted.user ?? null,
  accessToken: persisted.token ?? null,
  refreshToken: persisted.refreshToken ?? null,
  isAuthenticated: Boolean(persisted.token && persisted.user),
  isBootstrapping: Boolean(persisted.token && !persisted.user),
  mfaChallenge: null,
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
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
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
      storage.set(STORAGE_KEYS.AUTH_USER, user);
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
    userUpdated(state, action) {
      state.user = { ...state.user, ...action.payload };
      storage.set(STORAGE_KEYS.AUTH_USER, state.user);
    },
    logoutFulfilled(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isBootstrapping = false;
      state.mfaChallenge = null;
      state.error = null;

      storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      storage.remove(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`);
      storage.remove(STORAGE_KEYS.AUTH_USER);
    },
    sessionExpired(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isBootstrapping = false;
      state.error = 'SESSION_EXPIRED';

      storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      storage.remove(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`);
      storage.remove(STORAGE_KEYS.AUTH_USER);
    },
    activityPing(state) {
      state.lastActivityAt = Date.now();
    },
  },
});

export const authActions = authSlice.actions;
export const authReducer = authSlice.reducer;

export const selectCurrentUser = (state) => state.auth.user;
export const selectAccessToken = (state) => state.auth.accessToken;
export const selectRefreshToken = (state) => state.auth.refreshToken;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsBootstrapping = (state) => state.auth.isBootstrapping;
export const selectMfaChallenge = (state) => state.auth.mfaChallenge;
export const selectAuthError = (state) => state.auth.error;

export default authSlice.reducer;