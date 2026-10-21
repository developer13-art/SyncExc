import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const sourcesApi = {
  list: (params) => api.getPaged(endpoints.sources.list, { params }),

  create: (payload) => api.post(endpoints.sources.create, payload),

  telegramSendCode: (phoneNumber) => api.post('/sources/telegram/login/code', { phoneNumber }),

  telegramVerifyCode: (payload) => api.post('/sources/telegram/login/verify', payload),

  telegramListChannels: (loginId) => api.post('/sources/telegram/login/channels', { loginId }),

  telegramCreateSources: (payload) => api.post('/sources/telegram/login/sources', payload),

  telegramReauthorizeSource: (payload) =>
    api.post('/sources/telegram/login/reauthorize', payload),

  telegramCancelLogin: (loginId) => api.delete('/sources/telegram/login', { data: { loginId } }),

  getById: (sourceId) => api.get(endpoints.sources.detail(sourceId)),

  listTelegramMessages: (sourceId, params) =>
    api.get(endpoints.sources.telegramMessages(sourceId), { params }),

  update: (sourceId, payload) => api.patch(endpoints.sources.detail(sourceId), payload),

  setMonitoring: (sourceId, enabled) =>
    api.put(`${endpoints.sources.detail(sourceId)}/monitoring`, { enabled }),

  getExecutionConfig: (sourceId) =>
    api.get(`${endpoints.sources.detail(sourceId)}/execution-config`),

  updateExecutionConfig: (sourceId, payload) =>
    api.put(`${endpoints.sources.detail(sourceId)}/execution-config`, payload),

  enable: (sourceId) => api.post(endpoints.sources.enable(sourceId)),

  pause: (sourceId, payload) => api.post(endpoints.sources.pause(sourceId), payload),

  revalidate: (sourceId, payload) => api.post(endpoints.sources.revalidate(sourceId), payload),

  archive: (sourceId, payload) => api.post(endpoints.sources.archive(sourceId), payload),

  restore: (sourceId) => api.post(endpoints.sources.restore(sourceId)),

  remove: (sourceId, payload) => api.delete(endpoints.sources.remove(sourceId), { data: payload }),

  listDiscoveryJobs: (params) => api.getPaged(endpoints.sources.discoveryJobs, { params }),

  createDiscoveryJob: (payload) => api.post(endpoints.sources.discoveryJobs, payload),

  getDiscoveryJob: (jobId) => api.get(endpoints.sources.discoveryJob(jobId)),

  cancelDiscoveryJob: (jobId) => api.post(endpoints.sources.cancelDiscoveryJob(jobId)),

  listCandidates: (params) => api.getPaged(endpoints.sources.candidates, { params }),

  getCandidate: (candidateId) => api.get(endpoints.sources.candidate(candidateId)),

  registerCandidate: (candidateId, payload) =>
    api.post(endpoints.sources.registerCandidate(candidateId), payload),

  submitForReview: (sourceId, payload) => api.post(endpoints.sources.reviews(sourceId), payload),

  approveReview: (reviewId, payload) =>
    api.post(endpoints.sources.approveReview(reviewId), payload),

  rejectReview: (reviewId, payload) => api.post(endpoints.sources.rejectReview(reviewId), payload),

  requestReviewInfo: (reviewId, payload) =>
    api.post(endpoints.sources.requestInfoReview(reviewId), payload),

  getConnection: (sourceId) => api.get(endpoints.sources.connection(sourceId)),

  authorizeConnection: (sourceId, payload) =>
    api.post(endpoints.sources.authorizeConnection(sourceId), payload),

  testConnection: (sourceId) => api.post(endpoints.sources.testConnection(sourceId)),

  reauthorizeConnection: (sourceId, payload) =>
    api.post(endpoints.sources.reauthorizeConnection(sourceId), payload),

  disconnectConnection: (sourceId) => api.delete(endpoints.sources.disconnectConnection(sourceId)),

  listValidations: (sourceId, params) =>
    api.getPaged(endpoints.sources.validations(sourceId), { params }),

  getHealth: (sourceId) => api.get(endpoints.sources.health(sourceId)),

  getQuality: (sourceId) => api.get(endpoints.sources.quality(sourceId)),

  listSandboxTests: (sourceId, params) =>
    api.getPaged(endpoints.sources.sandboxTests(sourceId), { params }),

  createSandboxTest: (sourceId, payload) =>
    api.post(endpoints.sources.sandboxTests(sourceId), payload),

  getSandboxTest: (sourceId, testId) => api.get(endpoints.sources.sandboxTest(sourceId, testId)),

  listShares: (sourceId) => api.get(endpoints.sources.shares(sourceId)),

  createShare: (sourceId, payload) => api.post(endpoints.sources.shares(sourceId), payload),

  revokeShare: (sourceId, shareId) => api.delete(endpoints.sources.share(sourceId, shareId)),

  getAudit: (sourceId, params) => api.getPaged(endpoints.sources.audit(sourceId), { params }),

  listCategories: () => api.get(endpoints.sources.categories),
};
