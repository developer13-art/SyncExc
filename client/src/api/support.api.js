import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const supportApi = {
  listTickets: (params) => api.getPaged(endpoints.support.tickets, { params }),

  createTicket: (payload) => api.post(endpoints.support.tickets, payload),

  getTicket: (ticketId) => api.get(endpoints.support.ticket(ticketId)),

  updateTicket: (ticketId, payload) =>
    api.patch(endpoints.support.ticket(ticketId), payload),

  listMessages: (ticketId, params) =>
    api.getPaged(endpoints.support.ticketMessages(ticketId), { params }),

  postMessage: (ticketId, payload) =>
    api.post(endpoints.support.ticketMessages(ticketId), payload),

  listAttachments: (ticketId) => api.get(endpoints.support.ticketAttachments(ticketId)),

  uploadAttachment: (ticketId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.upload(endpoints.support.ticketAttachments(ticketId), formData);
  },

  removeAttachment: (ticketId, attachmentId) =>
    api.delete(endpoints.support.ticketAttachment(ticketId, attachmentId)),

  reopenTicket: (ticketId, payload) =>
    api.post(endpoints.support.ticketReopen(ticketId), payload),

  submitFeedback: (ticketId, payload) =>
    api.post(endpoints.support.ticketFeedback(ticketId), payload),

  listHelpArticles: (params) =>
    api.getPaged(endpoints.support.helpArticles, { params }),

  getHelpArticle: (slug) => api.get(endpoints.support.helpArticle(slug)),

  searchHelp: (params) => api.get(endpoints.support.helpSearch, { params }),

  submitHelpFeedback: (articleId, payload) =>
    api.post(endpoints.support.helpArticleFeedback(articleId), payload),

  listHelpCategories: () => api.get(endpoints.support.helpCategories),

  getSuggestions: (params) => api.get(endpoints.support.suggestions, { params }),

  listAgentQueues: () => api.get(endpoints.support.agentQueues),

  listAgentTickets: (params) => api.getPaged(endpoints.support.agentTickets, { params }),

  assignTicket: (ticketId, payload) =>
    api.post(endpoints.support.agentAssign(ticketId), payload),

  changeTicketStatus: (ticketId, payload) =>
    api.post(endpoints.support.agentStatus(ticketId), payload),

  changeTicketPriority: (ticketId, payload) =>
    api.post(endpoints.support.agentPriority(ticketId), payload),

  addInternalNote: (ticketId, payload) =>
    api.post(endpoints.support.agentInternalNotes(ticketId), payload),

  escalateTicket: (ticketId, payload) =>
    api.post(endpoints.support.agentEscalate(ticketId), payload),

  getDiagnostics: (ticketId, params) =>
    api.get(endpoints.support.agentDiagnostics(ticketId), { params }),

  requestDiagnostic: (ticketId, payload) =>
    api.post(endpoints.support.agentDiagnostics(ticketId), payload),

  linkTicket: (ticketId, payload) =>
    api.post(endpoints.support.agentLinks(ticketId), payload),

  getAgentMetrics: (params) => api.get(endpoints.support.agentMetrics, { params }),
};