import { adminApi } from './client.js';

export const workspacesApi = {
  list: (params) => adminApi.getPaged('/workspaces', { params }),
  get: (workspaceId) => adminApi.get(`/workspaces/${workspaceId}`),
  members: (workspaceId, params) =>
    adminApi.getPaged(`/workspaces/${workspaceId}/members`, { params }),
  suspend: (workspaceId, payload) =>
    adminApi.post(`/workspaces/${workspaceId}/suspend`, payload),
  restore: (workspaceId, payload) =>
    adminApi.post(`/workspaces/${workspaceId}/restore`, payload),
  audit: (workspaceId, params) =>
    adminApi.getPaged(`/workspaces/${workspaceId}/audit`, { params }),
};