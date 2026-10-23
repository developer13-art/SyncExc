import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const referralApi = {
  trackClick: (payload) => api.post(endpoints.referral.trackClick, payload),

  getProfile: () => api.get(endpoints.referral.profile),

  enroll: (payload) => api.post(endpoints.referral.enroll, payload),

  listLinks: (params) => api.getPaged(endpoints.referral.referralLinks, { params }),

  createLink: (payload) => api.post(endpoints.referral.referralLinks, payload),

  updateLink: (linkId, payload) =>
    api.patch(endpoints.referral.referralLink(linkId), payload),

  pauseLink: (linkId, payload) => api.post(endpoints.referral.pauseLink(linkId), payload),

  resumeLink: (linkId, payload) => api.post(endpoints.referral.resumeLink(linkId), payload),

  revokeLink: (linkId, payload) => api.post(endpoints.referral.revokeLink(linkId), payload),

  getDashboard: () => api.get(endpoints.referral.dashboard),

  listReferrals: (params) => api.getPaged(endpoints.referral.referrals, { params }),

  getAttribution: (attributionId) =>
    api.get(endpoints.referral.attribution(attributionId)),

  listCommissions: (params) =>
    api.getPaged(endpoints.referral.commissions, { params }),

  getLedger: (params) => api.getPaged(endpoints.referral.ledger, { params }),

  listStatements: (params) => api.getPaged(endpoints.referral.statements, { params }),

  getStatement: (statementId) => api.get(endpoints.referral.statement(statementId)),

  listCampaigns: (params) => api.getPaged(endpoints.referral.campaigns, { params }),

  createCampaign: (payload) => api.post(endpoints.referral.campaigns, payload),

  listPayoutMethods: () => api.get(endpoints.referral.payoutMethods),

  addPayoutMethod: (payload) => api.post(endpoints.referral.payoutMethods, payload),

  updatePayoutMethod: (methodId, payload) =>
    api.patch(endpoints.referral.payoutMethod(methodId), payload),

  disablePayoutMethod: (methodId) =>
    api.post(endpoints.referral.disablePayoutMethod(methodId)),

  listPayouts: (params) => api.getPaged(endpoints.referral.payouts, { params }),

  requestPayout: (payload) => api.post(endpoints.referral.payouts, payload),

  getPayout: (payoutId) => api.get(endpoints.referral.payout(payoutId)),

  cancelPayout: (payoutId, payload) =>
    api.post(endpoints.referral.cancelPayout(payoutId), payload),
};