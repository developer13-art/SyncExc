import { adminApi } from './client.js';

export const supportApi = {
  queues: () => adminApi.get('/support/queues'),
  createQueue: (payload) => adminApi.post('/support/queues', payload),
  updateQueue: (queueId, payload) =>
    adminApi.patch(`/support/queues/${queueId}`, payload),
  listTickets: (params) => adminApi.getPaged('/support/tickets', { params }),
  getTicket: (ticketId) => adminApi.get(`/support/tickets/${ticketId}`),
  assignTicket: (ticketId, payload) =>
    adminApi.post(`/support/tickets/${ticketId}/assign`, payload),
  escalateTicket: (ticketId, payload) =>
    adminApi.post(`/support/tickets/${ticketId}/escalate`, payload),
  metrics: (params) => adminApi.get('/support/metrics', { params }),
};