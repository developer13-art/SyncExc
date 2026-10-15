import axios from 'axios';

import { apiConfig } from '../config/api.config.js';

import {
  attachAuthHeader,
  attachCorrelationId,
  attachWorkspaceHeader,
  attachIdempotencyKey,
  handleRequestError,
  handleResponseSuccess,
  handleResponseError,
} from './interceptors.js';

export const axiosInstance = axios.create({
  baseURL: apiConfig.baseURL,
  timeout: apiConfig.timeoutMs,
  headers: apiConfig.headers,
  withCredentials: true,
  paramsSerializer: {
    indexes: null,
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    attachCorrelationId(config);
    attachAuthHeader(config);
    attachWorkspaceHeader(config);
    attachIdempotencyKey(config);
    return config;
  },
  handleRequestError,
);

axiosInstance.interceptors.response.use(handleResponseSuccess, handleResponseError);

function unwrap(response) {
  if (response?.data && typeof response.data === 'object' && 'data' in response.data) {
    return response.data.data;
  }
  return response?.data;
}

function unwrapPaged(response) {
  const body = response?.data;
  if (!body || typeof body !== 'object') {
    return { items: [], meta: {} };
  }
  if ('data' in body) {
    return {
      items: Array.isArray(body.data) ? body.data : (body.data?.items ?? []),
      meta: {
        ...(body.meta ?? body.data?.meta ?? {}),
        ...(body.pagination?.total !== undefined
          ? { total: body.pagination.total }
          : {}),
      },
    };
  }
  return {
    items: Array.isArray(body.items) ? body.items : [],
    meta: body.meta ?? {},
  };
}

export const api = {
  get(url, config = {}) {
    return axiosInstance.get(url, config).then(unwrap);
  },

  getPaged(url, config = {}) {
    return axiosInstance.get(url, config).then(unwrapPaged);
  },

  post(url, data, config = {}) {
    return axiosInstance.post(url, data, config).then(unwrap);
  },

  put(url, data, config = {}) {
    return axiosInstance.put(url, data, config).then(unwrap);
  },

  patch(url, data, config = {}) {
    return axiosInstance.patch(url, data, config).then(unwrap);
  },

  delete(url, config = {}) {
    return axiosInstance.delete(url, config).then(unwrap);
  },

  upload(url, formData, config = {}) {
    return axiosInstance
      .post(url, formData, {
        ...config,
        timeout: apiConfig.uploadTimeoutMs,
        headers: {
          ...(config.headers ?? {}),
          'Content-Type': 'multipart/form-data',
        },
      })
      .then(unwrap);
  },

  download(url, config = {}) {
    return axiosInstance.get(url, {
      ...config,
      responseType: 'blob',
    });
  },
};

export default api;