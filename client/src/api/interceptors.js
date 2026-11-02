import { store } from '../app/store.js';
import { authActions, selectAccessToken } from '../features/auth/authSlice.js';
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

export function attachWorkspaceHeader(config) {
  const workspaceId = store.getState().workspace?.activeWorkspaceId;
  if (workspaceId && !config.headers['X-Workspace-Id']) {
    config.headers['X-Workspace-Id'] = workspaceId;
  }
  return config;
}

export function attachIdempotencyKey(config) {
  const method = config.method?.toLowerCase();
  if (['post', 'patch', 'put', 'delete'].includes(method) && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = generateIdempotencyKey();
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
  const originalRequest = error.config;

  if (parsed.status === 401 && !isPublicAuthRequest(originalRequest)) {
    if (shouldAttemptRefresh(originalRequest)) {
      const accessToken = await attemptTokenRefresh();
      if (accessToken) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        originalRequest._retryAttempted = true;
        const { default: axiosInstance } = await import('./client.js');
        return axiosInstance.request(originalRequest);
      }
    }
    store.dispatch(authActions.sessionExpired());
  }

  return Promise.reject(parsed);
}

function isPublicAuthRequest(config) {
  return /\/auth\/(login|register|mfa\/verify|refresh)(?:[/?]|$)/.test(config?.url ?? '');
}

function shouldAttemptRefresh(config) {
  return Boolean(config && !config._retryAttempted && !config.skipAuthRefresh);
}

async function attemptTokenRefresh() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { default: axiosInstance } = await import('./client.js');
      const response = await axiosInstance.post(
        '/auth/refresh',
        {},
        { skipAuthRefresh: true, _retryAttempted: true },
      );

      const accessToken = response.data?.data?.accessToken;
      if (accessToken) {
        store.dispatch(authActions.tokenRefreshed({ accessToken }));
        return accessToken;
      }
      return null;
    } catch {
      return null;
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

export function generateIdempotencyKey() {
  return generateCorrelationId();
}