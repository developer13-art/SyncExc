import { adminApi } from './client.js';

export const sourceDiscoveryApi = {
  candidates: (params) => adminApi.getPaged('/source-discovery/candidates', { params }),
  getCandidate: (candidateId) =>
    adminApi.get(`/source-discovery/candidates/${candidateId}`),
  decide: (candidateId, payload) =>
    adminApi.post(`/source-discovery/candidates/${candidateId}/decisions`, payload),
  register: (candidateId, payload) =>
    adminApi.post(`/source-discovery/candidates/${candidateId}/register`, payload),
};