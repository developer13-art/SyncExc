/**
 * SyncExc Server — Billing controllers
 */

import { serializeSubscription, serializePayment, serializeInvoice, serializeRefund, serializePlan } from '../../lib/serializers.js';
import { success, created, paginated } from '../../lib/response.js';

export function createBillingController({ service }) {
  return {
    async listPaymentProviders(_req, res) {
      return success(res, service.listPaymentProviders());
    },

    async listPlans(req, res) {
      const plans = await service.listPlans();
      return success(res, plans);
    },

    async getPlan(req, res) {
      const plan = await service.getPlan(req.params.planId);
      return success(res, plan);
    },

    async createCheckout(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;

      const session = await service.createCheckoutSession({
        scopeType,
        scopeId,
        planPriceId: req.body.planPriceId,
        providerName: req.body.provider,
        successUrl: req.body.successUrl,
        cancelUrl: req.body.cancelUrl,
      });
      return created(res, session);
    },

    async getCheckoutStatus(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;
      const checkout = await service.getCheckoutStatus({
        checkoutId: req.params.checkoutId,
        scopeType,
        scopeId,
      });
      return success(res, checkout);
    },

    async getSubscription(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;

      const sub = await service.getActiveSubscriptionForScope(scopeType, scopeId);
      if (!sub) return success(res, null);
      const entitlements = await service.listEntitlementsForScope({ scopeType, scopeId });
      return success(res, {
        ...serializeSubscription(sub),
        entitlements,
      });
    },

    async getEntitlements(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;
      return success(
        res,
        await service.listEntitlementsForScope({ scopeType, scopeId })
      );
    },

    async getUsage(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;
      return success(res, await service.getUsageForScope({ scopeType, scopeId }));
    },

    async cancelSubscription(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;

      const sub = await service.getActiveSubscriptionForScope(scopeType, scopeId);
      if (!sub) return success(res, null);

      const updated = await service.cancelSubscription({
        userId: req.auth.userId,
        subscriptionId: sub.id,
        reason: req.body.reason,
        immediate: req.body.immediate,
      });
      return success(res, serializeSubscription(updated));
    },

    async reactivateSubscription(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;
      const sub = await service.getActiveSubscriptionForScope(scopeType, scopeId);
      if (!sub) return success(res, null);
      const updated = await service.reactivateSubscription({
        userId: req.auth.userId,
        subscriptionId: sub.id,
      });
      return success(res, serializeSubscription(updated));
    },

    async listPayments(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;

      const { rows, nextCursor } = await service.listPaymentsForScope({
        scopeType,
        scopeId,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializePayment), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async listInvoices(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;

      const { rows, nextCursor } = await service.listInvoicesForScope({
        scopeType,
        scopeId,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeInvoice), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async getInvoice(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;

      const invoice = await service.getInvoice({
        invoiceId: req.params.invoiceId,
        scopeType,
        scopeId,
      });
      return success(res, serializeInvoice(invoice));
    },

    async requestRefund(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;

      const refund = await service.requestRefund({
        userId: req.auth.userId,
        scopeType,
        scopeId,
        paymentId: req.body.paymentId,
        amountMinor: req.body.amountMinor,
        reason: req.body.reason,
      });
      return created(res, serializeRefund(refund));
    },

    async listRefunds(req, res) {
      const scopeType = req.workspace?.id ? 'workspace' : 'user';
      const scopeId = req.workspace?.id || req.auth.userId;

      const refunds = await service.listRefunds({
        userId: req.auth.userId,
        scopeType,
        scopeId,
      });
      return success(res, refunds.map(serializeRefund));
    },

    async handleWebhook(req, res) {
      const result = await service.handleProviderWebhook({
        providerName: req.params.provider,
        event: req.body,
        rawBody: req.rawBody,
      });
      return success(res, result);
    },
  };
}

export default createBillingController;