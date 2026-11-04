import { adminApi, adminAxios } from './client.js';

function resourcePath(resourceKey) {
  return `/console/resources/${encodeURIComponent(resourceKey)}`;
}

export const consoleApi = {
  page: (sectionId, pageId) =>
    adminApi.get(`/console/pages/${encodeURIComponent(sectionId)}/${encodeURIComponent(pageId)}`),

  resources: () => adminApi.get('/console/resources'),

  list: (resourceKey, params) =>
    adminApi.getPaged(resourcePath(resourceKey), { params }),

  summary: (resourceKey, params) =>
    adminApi.get(`${resourcePath(resourceKey)}/summary`, { params }),

  detail: (resourceKey, recordId) =>
    adminApi.get(`${resourcePath(resourceKey)}/${encodeURIComponent(recordId)}`),

  action: (resourceKey, recordId, actionKey, payload) =>
    adminApi.post(
      `${resourcePath(resourceKey)}${recordId ? `/${encodeURIComponent(recordId)}` : ''}/actions/${encodeURIComponent(actionKey)}`,
      payload,
    ),

  addNote: (resourceKey, recordId, note) =>
    adminApi.post(`${resourcePath(resourceKey)}/${encodeURIComponent(recordId)}/notes`, { note }),

  system: () => adminApi.get('/console/system/overview'),

  analytics: (sectionId, params) =>
    adminApi.get(`/console/analytics/${encodeURIComponent(sectionId)}`, { params }),

  async exportCsv(resourceKey, params) {
    const response = await adminAxios.get(`${resourcePath(resourceKey)}/export`, {
      params,
      responseType: 'blob',
    });
    const disposition = response.headers?.['content-disposition'] ?? '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return {
      blob: response.data,
      filename: match?.[1] ?? `${resourceKey}.csv`,
    };
  },
};

export default consoleApi;
