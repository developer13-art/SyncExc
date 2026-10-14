import { adminApi } from './client.js';

export const rolesApi = {
  list: (params) => adminApi.getPaged('/roles', { params }),
  get: (roleId) => adminApi.get(`/roles/${roleId}`),
  create: (payload) => adminApi.post('/roles', payload),
  update: (roleId, payload) => adminApi.patch(`/roles/${roleId}`, payload),
  delete: (roleId) => adminApi.delete(`/roles/${roleId}`),
  permissions: () => adminApi.get('/permissions'),
  rolePermissions: (roleId) => adminApi.get(`/roles/${roleId}/permissions`),
  setPermissions: (roleId, payload) =>
    adminApi.put(`/roles/${roleId}/permissions`, payload),
  assignments: (params) => adminApi.getPaged('/roles/assignments', { params }),
  assign: (payload) => adminApi.post('/roles/assignments', payload),
  revoke: (assignmentId) => adminApi.delete(`/roles/assignments/${assignmentId}`),
  grants: (params) => adminApi.getPaged('/roles/access-grants', { params }),
  createGrant: (payload) => adminApi.post('/roles/access-grants', payload),
  revokeGrant: (grantId, payload) =>
    adminApi.post(`/roles/access-grants/${grantId}/revoke`, payload),
};