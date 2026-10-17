import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const signalsApi = {
  ingest: (payload) => api.post(endpoints.signals.ingest, payload),

  listMessages: (params) => api.getPaged(endpoints.signals.messages, { params }),

  getMessage: (messageId) => api.get(endpoints.signals.message(messageId)),

  reprocessMessage: (messageId, payload) =>
    api.post(endpoints.signals.reprocess(messageId), payload),

  getProcessingJob: (jobId) => api.get(endpoints.signals.processingJobs(jobId)),

  listSignals: (params) => api.getPaged(endpoints.signals.list, { params }),

  getSignal: (signalId) => api.get(endpoints.signals.detail(signalId)),

  listSignalVersions: (signalId) => api.get(endpoints.signals.versions(signalId)),

  listSignalIssues: (signalId) => api.get(endpoints.signals.issues(signalId)),

  submitReview: (signalId, payload) =>
    api.post(endpoints.signals.submitReview, { ...payload, candidateId: signalId }),

  validateSignal: (signalId, payload) =>
    api.post(endpoints.signals.validate(signalId), payload),

  getValidation: (signalId) => api.get(endpoints.signals.validation(signalId)),

  getEligibility: (signalId) => api.get(endpoints.signals.eligibility(signalId)),

  createIntent: (signalId, payload) =>
    api.post(endpoints.signals.createIntent, { ...payload, signalId }),

  getIntent: (intentId) => api.get(endpoints.signals.intent(intentId)),

  cancelIntent: (intentId, payload) =>
    api.post(endpoints.signals.cancelIntent(intentId), payload),

  getAudit: (params) => api.getPaged(endpoints.signals.audit, { params }),

  getMetrics: (params) => api.get(endpoints.signals.metrics, { params }),
};