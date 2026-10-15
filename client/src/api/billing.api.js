import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const billingApi = {
  listPlans: (params) => api.get(endpoints.billing.plans, { params }),

  listPaymentProviders: () => api.get(endpoints.billing.paymentProviders),

  getPlan: (planId) => api.get(endpoints.billing.plan(planId)),

  getSubscription: () => api.get(endpoints.billing.subscription),

  createCheckout: (payload) => api.post(endpoints.billing.checkout, payload),

  getCheckoutStatus: (checkoutId) => api.get(endpoints.billing.checkoutStatus(checkoutId)),

  changePlan: (payload) => api.post(endpoints.billing.changePlan, payload),

  cancelSubscription: (payload) => api.post(endpoints.billing.cancel, payload),

  reactivateSubscription: (payload) => api.post(endpoints.billing.reactivate, payload),

  listPayments: (params) => api.getPaged(endpoints.billing.payments, { params }),

  getPayment: (paymentId) => api.get(endpoints.billing.payment(paymentId)),

  listInvoices: (params) => api.getPaged(endpoints.billing.invoices, { params }),

  getInvoice: (invoiceId) => api.get(endpoints.billing.invoice(invoiceId)),

  downloadInvoice: (invoiceId) =>
    api.download(endpoints.billing.invoiceDownload(invoiceId)),

  listRefundRequests: (params) => api.getPaged(endpoints.billing.refundRequests, { params }),

  submitRefundRequest: (payload) => api.post(endpoints.billing.refundRequests, payload),

  getUsage: () => api.get(endpoints.billing.usage),

  getEntitlements: () => api.get(endpoints.billing.entitlements),

  setupPaymentMethod: () => api.post(endpoints.billing.paymentMethodSetup),
};