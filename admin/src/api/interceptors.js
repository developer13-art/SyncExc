import { store } from '../app/store.js';
import { authActions, selectAccessToken, selectRefreshToken } from '../features/auth/authSlice.js';
import { STORAGE_KEYS, storage } from '../lib/utils/storage.util.js';

import { parseAxiosError } from './errors.js';

let refreshPromise = null;

export function attachAuthHeader(config) {
  const token = selectAccessToken(store.getState()) ?? storage.get(STORAGE_KEYS.AUTH_TOKEN);
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

export function attachCorrelationId(config) {
  if (!config.headers['X-Correlation-Id']) {
    config.headers['X-Correlation-Id'] = generateCorrelationId();
  }
  return config;
}

export function attachIdempotencyKey(config) {
  const method = config.method?.toLowerCase();
  if (
    ['post', 'patch', 'put', 'delete'].includes(method) &&
    !config.headers['Idempotency-Key']
  ) {
    config.headers['Idempotency-Key'] = generateCorrelationId();
  }
  return config;
}

export function handleRequestError(error) {
  return Promise.reject(parseAxiosError(error));
}

export async function handleResponseSuccess(response) {
  return response;
}

export async function handleResponseError(error) {
  const parsed = parseAxiosError(error);

  if (parsed.status === 401 && shouldAttemptRefresh(error.config)) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      const originalRequest = error.config;
      const token =
        selectAccessToken(store.getState()) ?? storage.get(STORAGE_KEYS.AUTH_TOKEN);
      originalRequest.headers.Authorization = `Bearer ${token}`;
      originalRequest._retryAttempted = true;
      const { default: axiosInstance } = await import('./client.js');
      return axiosInstance.request(originalRequest);
    }
    store.dispatch(authActions.sessionExpired());
  }

  return Promise.reject(parsed);
}

function shouldAttemptRefresh(config) {
  if (!config) {
    return false;
  }
  if (config._retryAttempted) {
    return false;
  }
  if (config.url?.includes('/auth/refresh') || config.url?.includes('/auth/login')) {
    return false;
  }
  if (config.skipAuthRefresh) {
    return false;
  }
  const refreshToken =
    selectRefreshToken(store.getState()) ??
    storage.get(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`);
  return Boolean(refreshToken);
}

async function attemptTokenRefresh() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = selectRefreshToken(store.getState());
      if (!refreshToken) {
        return false;
      }
      const { default: axiosInstance } = await import('./client.js');
      const response = await axiosInstance.post(
        '/admin/auth/refresh',
        { refreshToken },
        { skipAuthRefresh: true, _retryAttempted: true },
      );
      const { accessToken, refreshToken: newRefreshToken } = response.data?.data ?? {};
      if (accessToken) {
        store.dispatch(
          authActions.tokenRefreshed({
            accessToken,
            refreshToken: newRefreshToken ?? refreshToken,
          }),
        );
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function generateCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}