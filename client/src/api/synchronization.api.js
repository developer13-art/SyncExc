import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const synchronizationApi = {
  listGroups: (params) => api.getPaged(endpoints.synchronization.groups, { params }),

  createGroup: (payload) => api.post(endpoints.synchronization.groups, payload),

  getGroup: (groupId) => api.get(endpoints.synchronization.group(groupId)),

  updateGroup: (groupId, payload) =>
    api.patch(endpoints.synchronization.group(groupId), payload),

  activateGroup: (groupId) => api.post(endpoints.synchronization.activate(groupId)),

  pauseGroup: (groupId, payload) =>
    api.post(endpoints.synchronization.pause(groupId), payload),

  resumeGroup: (groupId) => api.post(endpoints.synchronization.resume(groupId)),

  listVersions: (groupId) => api.get(endpoints.synchronization.versions(groupId)),

  getHealth: (groupId) => api.get(endpoints.synchronization.health(groupId)),

  setSource: (groupId, payload) => api.put(endpoints.synchronization.source(groupId), payload),

  listDestinations: (groupId) => api.get(endpoints.synchronization.destinations(groupId)),

  addDestination: (groupId, payload) =>
    api.post(endpoints.synchronization.destinations(groupId), payload),

  updateDestination: (groupId, destinationId, payload) =>
    api.patch(endpoints.synchronization.destination(groupId, destinationId), payload),

  removeDestination: (groupId, destinationId) =>
    api.delete(endpoints.synchronization.destination(groupId, destinationId)),

  validateMapping: (payload) => api.post(endpoints.synchronization.validateMapping, payload),

  listInstruments: (params) =>
    api.get(endpoints.synchronization.instruments, { params }),

  preview: (groupId, payload) =>
    api.post(endpoints.synchronization.preview(groupId), payload),

  listOperations: (params) => api.getPaged(endpoints.synchronization.operations, { params }),

  getOperation: (operationId) =>
    api.get(endpoints.synchronization.operation(operationId)),

  getOperationDestinations: (operationId) =>
    api.get(endpoints.synchronization.operationDestinations(operationId)),

  getOperationTimeline: (operationId) =>
    api.get(endpoints.synchronization.operationTimeline(operationId)),

  reconcileOperation: (operationId, payload) =>
    api.post(endpoints.synchronization.reconcileOperation(operationId), payload),

  retryOperation: (operationId, payload) =>
    api.post(endpoints.synchronization.retryOperation(operationId), payload),

  manualResolve: (operationId, payload) =>
    api.post(endpoints.synchronization.manualResolve(operationId), payload),

  listRetryJobs: (params) =>
    api.getPaged(endpoints.synchronization.retryJobs, { params }),

  listUnresolvedJobs: (params) =>
    api.getPaged(endpoints.synchronization.unresolvedJobs, { params }),

  getMetrics: (params) => api.get(endpoints.synchronization.metrics, { params }),
};