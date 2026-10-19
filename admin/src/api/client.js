import axios from 'axios';

import {
  adminRequestInterceptor,
  adminRequestErrorInterceptor,
  adminResponseInterceptor,
  adminResponseErrorInterceptor,
} from './interceptors.js';
import { apiConfig } from '../config/api.config.js';

const baseURL = `${apiConfig.baseURL.replace(/\/+$/, '')}/admin`;

export const adminAxios = axios.create({
  baseURL,
  timeout: 30_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'X-Client-Name': 'syncexc-admin',
    'X-Client-Version': '1.0.0',
  },
});

adminAxios.interceptors.request.use(
  adminRequestInterceptor,
  adminRequestErrorInterceptor,
);
adminAxios.interceptors.response.use(
  adminResponseInterceptor,
  adminResponseErrorInterceptor,
);

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
  return { items: Array.isArray(body.items) ? body.items : [], meta: body.meta ?? {} };
}

export const adminApi = {
  get(url, config = {}) {
    return adminAxios.get(url, config).then(unwrap);
  },
  getPaged(url, config = {}) {
    return adminAxios.get(url, config).then(unwrapPaged);
  },
  post(url, data, config = {}) {
    return adminAxios.post(url, data, config).then(unwrap);
  },
  put(url, data, config = {}) {
    return adminAxios.put(url, data, config).then(unwrap);
  },
  patch(url, data, config = {}) {
    return adminAxios.patch(url, data, config).then(unwrap);
  },
  delete(url, config = {}) {
    return adminAxios.delete(url, config).then(unwrap);
  },
  upload(url, formData, config = {}) {
    return adminAxios
      .post(url, formData, {
        ...config,
        headers: {
          ...(config.headers ?? {}),
          'Content-Type': 'multipart/form-data',
        },
      })
      .then(unwrap);
  },
};

export default adminApi;