/**
 * SyncExc Server — Billing service
 */

import { randomUUID } from 'node:crypto';
import {
  AppError,
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../../lib/errors.js';
import {
  SUBSCRIPTION_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  INVOICE_STATUS,
} from '@syncexc/shared';

const CHECKOUT_TTL_MS = 60 * 60 * 1000; // 1 hour

function generateInvoiceNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${ts}-${rand}`;
}

function computePeriodEnd(start, interval) {
  const end = new Date(start);
  if (interval === 'yearly') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

export function createBillingService({ db, queries, rateLimiter, mailer, events, audit, providerFactory, logger }) {
  /* ===========================================================================
   * PLANS
   * ======================================================================== */

  async function listPlans() {
    const plans = await queries.listPlans({ status: 'active' });
    const result = [];
    for (const plan of plans) {
      const version = plan.latest_version;
      const prices = version ? await queries.listPlanPrices(version.id) : [];
      result.push({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        features: version?.features || {},
        limits: version?.limits || {},
        prices: prices.map((p) => ({
          id: p.id,
          currency: p.currency,
          amountMinor: Number(p.amount_minor),
          billingInterval: p.billing_interval,
        })),
      });
    }
    return result;
  }

  async function getPlan(planId) {
    const plan = await queries.findPlanById(planId);
    if (!plan) throw new NotFoundError('Plan');
    const version = await queries.findLatestPlanVersion(planId);
    const prices = version ? await queries.listPlanPrices(version.id) : [];
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      status: plan.status,
      features: version?.features || {},
      limits: version?.limits || {},
      prices: prices.map((p) => ({
        id: p.id,
        currency: p.currency,
        amountMinor: Number(p.amount_minor),
        billingInterval: p.billing_interval,
      })),
    };
  }

  /* ===========================================================================
   * CHECKOUT
   * ======================================================================== */

  async function createCheckoutSession({
    scopeType,
    scopeId,
    planPriceId,
    providerName,
    successUrl,
    cancelUrl,
  }) {
    const price = await queries.findPlanPriceById(planPriceId);
    if (!price) throw new NotFoundError('Price');

    if (price.effective_until && new Date(price.effective_until) <= new Date()) {
      throw new ConflictError('Price is no longer available', 'PRICE_EXPIRED');
    }

    const provider = providerFactory.get(providerName);
    if (!provider) throw new ValidationError(`Unknown provider: ${providerName}`);

    const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MS);

    const checkout = await db.tx(async (tx) => {
      return queries.insertCheckoutSession(tx, {
        scopeType,
        scopeId,
        planPriceId,
        provider: providerName,
        amountMinor: Number(price.amount_minor),
        currency: price.currency,
        successUrl,
        cancelUrl,
        expiresAt,
        metadata: {},
      });
    });

    // Create the provider-side session
    const session = await provider.createCheckout({
      amountMinor: Number(price.amount_minor),
      currency: price.currency,
      reference: checkout.id,
      successUrl,
      cancelUrl,
      customer: { scopeType, scopeId },
    });

    await queries.updateCheckoutSession(checkout.id, {
      providerCheckoutReference: session.id,
    });

    return {
      checkoutId: checkout.id,
      provider: providerName,
      providerCheckoutReference: session.id,
      redirectUrl: session.redirectUrl,
      amountMinor: Number(price.amount_minor),
      currency: price.currency,
      expiresAt,
    };
  }

  /* ===========================================================================
   * SUBSCRIPTIONS
   * ======================================================================== */

  async function getActiveSubscriptionForScope(scopeType, scopeId) {
    return queries.findActiveSubscriptionForScope(scopeType, scopeId);
  }

  async function listSubscriptionsForScope({ scopeType, scopeId }) {
    return queries.listSubscriptionsForScope(scopeType, scopeId);
  }

  async function listEntitlementsForScope({ scopeType, scopeId }) {
    const rows = await queries.listEntitlementsForScope(scopeType, scopeId);
    const out = {};
    for (const row of rows) {
      out[row.feature_key] = row.value;
    }
    return out;
  }

  async function checkEntitlement({ scopeType, scopeId, featureKey }) {
    // Owner of a personal workspace is covered by the personal scope
    const entitlements = await listEntitlementsForScope({ scopeType, scopeId });
    const value = entitlements[featureKey];

    if (value === undefined) {
      return { allowed: false, reason: 'entitlement_not_granted', featureKey };
    }

    if (typeof value === 'boolean') {
      return { allowed: value, featureKey };
    }

    if (typeof value === 'number') {
      // For numeric limits, check current usage
      const dimension = featureKey;
      const periodStart = new Date();
      periodStart.setUTCDate(1);
      periodStart.setUTCHours(0, 0, 0, 0);

      const counter = await queries.getUsageCounter({
        scopeType,
        scopeId,
        dimension,
        periodStart,
      });
      const current = counter ? Number(counter.current_value) : 0;
      return {
        allowed: current < value,
        featureKey,
        limit: value,
        current,
        reason: current < value ? null : 'quota_exceeded',
      };
    }

    return { allowed: false, featureKey, reason: 'invalid_entitlement_value' };
  }

  async function recordUsage({ scopeType, scopeId, dimension, amount = 1, eventId = null }) {
    if (eventId) {
      // Idempotent: if this event was already recorded, skip
      const exists = await db.query(
        `SELECT 1 FROM subscription_usage_events WHERE event_id = $1 LIMIT 1`,
        [eventId]
      );
      if (exists.rows.length > 0) return { alreadyRecorded: true };

      await db.query(
        `
        INSERT INTO subscription_usage_events (
          event_id, billing_scope_type, billing_scope_id, usage_dimension, amount
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [eventId, scopeType, scopeId, dimension, amount]
      );
    }

    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = computePeriodEnd(periodStart, 'monthly');

    return queries.incrementUsageCounter({
      scopeType,
      scopeId,
      dimension,
      amount,
      periodStart,
      periodEnd,
    });
  }

  async function cancelSubscription({ userId, subscriptionId, reason, immediate }) {
    const sub = await queries.findSubscriptionById(subscriptionId);
    if (!sub) throw new NotFoundError('Subscription');

    if (
      ![SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE, SUBSCRIPTION_STATUS.GRACE_PERIOD].includes(
        sub.status
      )
    ) {
      throw new ConflictError('Subscription cannot be cancelled in its current state', 'INVALID_STATE');
    }

    const updates = immediate
      ? { status: SUBSCRIPTION_STATUS.CANCELED, canceledAt: new Date(), endedAt: new Date() }
      : { status: SUBSCRIPTION_STATUS.CANCEL_SCHEDULED, cancelAtPeriodEnd: true, canceledAt: new Date() };

    return db.tx(async (tx) => {
      const updated = await queries.updateSubscription(subscriptionId, updates);

      await events.publish(
        tx,
        'billing.subscription_canceled',
        { subscriptionId, immediate, reason },
        {
          actorId: userId,
          resourceType: 'subscription',
          resourceId: subscriptionId,
        }
      );

      if (immediate) {
        await queries.revokeEntitlementsForSubscription(subscriptionId);
      }

      return updated;
    });
  }

  /* ===========================================================================
   * PAYMENTS
   * ======================================================================== */

  async function listPaymentsForScope({ scopeType, scopeId, limit, cursor }) {
    return queries.listPaymentsForScope(scopeType, scopeId, { limit, cursor });
  }

  /* ===========================================================================
   * INVOICES
   * ======================================================================== */

  async function listInvoicesForScope({ scopeType, scopeId, limit, cursor }) {
    return queries.listInvoicesForScope(scopeType, scopeId, { limit, cursor });
  }

  async function getInvoice({ invoiceId, scopeType, scopeId }) {
    const invoice = await queries.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');
    if (invoice.billing_scope_type !== scopeType || invoice.billing_scope_id !== scopeId) {
      throw new NotFoundError('Invoice');
    }
    return invoice;
  }

  /* ===========================================================================
   * REFUNDS
   * ======================================================================== */

  async function requestRefund({ userId, scopeType, scopeId, paymentId, amountMinor, reason }) {
    // Verify the payment belongs to this scope
    const payment = await db.query(
      `
      SELECT p.* FROM subscription_payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE p.id = $1 AND s.billing_scope_type = $2 AND s.billing_scope_id = $3
      `,
      [paymentId, scopeType, scopeId]
    );

    if (payment.rows.length === 0) throw new NotFoundError('Payment');
    const p = payment.rows[0];

    if (p.status !== PAYMENT_STATUS.SUCCEEDED && p.status !== PAYMENT_STATUS.PARTIALLY_REFUNDED) {
      throw new ConflictError('Payment is not eligible for refund', 'PAYMENT_NOT_REFUNDABLE');
    }

    // Check cumulative refunds don't exceed original
    const existingRefunds = await queries.listRefundsForPayment(paymentId);
    const totalRefunded = existingRefunds
      .filter((r) => r.status !== 'rejected' && r.status !== 'failed')
      .reduce((sum, r) => sum + Number(r.amount_minor), 0);
    const remaining = Number(p.amount_minor) - totalRefunded;

    if (amountMinor > remaining) {
      throw new ConflictError('Refund exceeds remaining refundable amount', 'REFUND_EXCEEDS_REMAINING');
    }

    const refund = await queries.insertRefund(null, {
      paymentId,
      amountMinor,
      currency: p.currency,
      reason,
      requestedBy: userId,
    });

    return refund;
  }

  async function listRefunds({ userId, scopeType, scopeId }) {
    const result = await db.query(
      `
      SELECT r.* FROM refund_records r
      JOIN subscription_payments p ON p.id = r.payment_id
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE s.billing_scope_type = $1 AND s.billing_scope_id = $2
      ORDER BY r.created_at DESC
      `,
      [scopeType, scopeId]
    );
    return result.rows;
  }

  /* ===========================================================================
   * WEBHOOKS
   * ======================================================================== */

  async function handleProviderWebhook({ providerName, event, rawBody }) {
    const provider = providerFactory.get(providerName);
    if (!provider) throw new ValidationError(`Unknown provider: ${providerName}`);

    const normalized = await provider.parseWebhookEvent({ event, rawBody });
    if (!normalized) {
      return { handled: false, reason: 'unrecognized_event' };
    }

    return db.tx(async (tx) => {
      const webhookEvent = await queries.insertWebhookEvent(tx, {
        provider: providerName,
        providerEventId: normalized.eventId,
        eventType: normalized.eventType,
        payload: normalized.raw,
      });

      // If insert returned null, event was already processed
      if (!webhookEvent) {
        return { handled: true, duplicate: true };
      }

      try {
        await processNormalizedWebhook({ tx, providerName, normalized });
        await queries.markWebhookEventProcessed(webhookEvent.id, 'processed');
        return { handled: true };
      } catch (err) {
        await queries.markWebhookEventProcessed(webhookEvent.id, 'failed', err.message);
        throw err;
      }
    });
  }

  async function processNormalizedWebhook({ tx, providerName, normalized }) {
    switch (normalized.eventType) {
      case 'payment.succeeded': {
        await handlePaymentSucceeded({ tx, providerName, data: normalized.data });
        return;
      }
      case 'payment.failed': {
        await handlePaymentFailed({ tx, providerName, data: normalized.data });
        return;
      }
      case 'subscription.updated':
      case 'subscription.deleted': {
        await handleSubscriptionUpdated({ tx, providerName, data: normalized.data });
        return;
      }
      case 'refund.completed': {
        await handleRefundCompleted({ tx, providerName, data: normalized.data });
        return;
      }
      default:
        logger.debug({ eventType: normalized.eventType }, 'Unhandled webhook event type');
    }
  }

  async function handlePaymentSucceeded({ tx, providerName, data }) {
    const existing = await queries.findPaymentByProviderReference(
      providerName,
      data.providerPaymentReference
    );
    if (existing && existing.status === PAYMENT_STATUS.SUCCEEDED) return;

    const checkout = await tx.query(
      `SELECT * FROM checkout_sessions WHERE id = $1`,
      [data.checkoutReference]
    );

    if (checkout.rows.length === 0) {
      logger.warn({ data }, 'Payment for unknown checkout session');
      return;
    }

    const co = checkout.rows[0];

    const payment = await queries.insertPayment(tx, {
      checkoutSessionId: co.id,
      provider: providerName,
      providerPaymentReference: data.providerPaymentReference,
      amountMinor: data.amountMinor,
      currency: data.currency,
      status: PAYMENT_STATUS.SUCCEEDED,
      paidAt: new Date(),
    });

    // Create or update subscription
    const planPrice = await queries.findPlanPriceById(co.plan_price_id);
    const planVersion = await queries.findPlanVersion(planPrice.plan_version_id);

    const existingSub = await queries.findActiveSubscriptionForScope(
      co.billing_scope_type,
      co.billing_scope_id
    );

    let subscription;
    if (existingSub) {
      const now = new Date();
      const periodEnd = computePeriodEnd(now, planPrice.billing_interval);
      subscription = await queries.updateSubscription(existingSub.id, {
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingAt: periodEnd,
      });
    } else {
      const now = new Date();
      const periodEnd = computePeriodEnd(now, planPrice.billing_interval);
      subscription = await queries.insertSubscription(tx, {
        scopeType: co.billing_scope_type,
        scopeId: co.billing_scope_id,
        planVersionId: planVersion.id,
        planPriceId: planPrice.id,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingAt: periodEnd,
      });

      // Grant entitlements from the plan version
      const features = planVersion.features || {};
      const limits = planVersion.limits || {};
      for (const [key, value] of Object.entries(features)) {
        await queries.insertEntitlement(tx, {
          scopeType: co.billing_scope_type,
          scopeId: co.billing_scope_id,
          subscriptionId: subscription.id,
          featureKey: key,
          value,
          sourceType: 'subscription',
        });
      }
      for (const [key, value] of Object.entries(limits)) {
        await queries.insertEntitlement(tx, {
          scopeType: co.billing_scope_type,
          scopeId: co.billing_scope_id,
          subscriptionId: subscription.id,
          featureKey: key,
          value,
          sourceType: 'subscription',
        });
      }
    }

    await queries.updateCheckoutSession(co.id, {
      status: 'completed',
      completedAt: new Date(),
    });

    await events.publish(
      tx,
      'billing.payment_succeeded',
      {
        paymentId: payment.id,
        subscriptionId: subscription.id,
        amountMinor: Number(payment.amount_minor),
        currency: payment.currency,
      },
      {
        workspaceId: co.billing_scope_type === 'workspace' ? co.billing_scope_id : null,
        actorId: co.billing_scope_type === 'user' ? co.billing_scope_id : null,
        resourceType: 'payment',
        resourceId: payment.id,
      }
    );

    await events.publish(
      tx,
      'billing.subscription_activated',
      {
        subscriptionId: subscription.id,
        planVersionId: subscription.plan_version_id,
      },
      {
        workspaceId: co.billing_scope_type === 'workspace' ? co.billing_scope_id : null,
        actorId: co.billing_scope_type === 'user' ? co.billing_scope_id : null,
        resourceType: 'subscription',
        resourceId: subscription.id,
      }
    );

    // Send confirmation email
    if (mailer) {
      mailer
        .send({
          to: data.customerEmail || 'customer@example.com',
          subject: 'Payment received',
          text: `We received your payment of ${payment.amount_minor / 100} ${payment.currency}.`,
        })
        .catch((err) => logger.error({ err }, 'Failed to send payment confirmation'));
    }
  }

  async function handlePaymentFailed({ tx, providerName, data }) {
    const sub = await queries.findActiveSubscriptionForScope(
      data.scopeType || 'workspace',
      data.scopeId
    );
    if (!sub) return;

    await queries.updateSubscription(sub.id, { status: SUBSCRIPTION_STATUS.PAST_DUE });

    await events.publish(
      tx,
      'billing.payment_failed',
      { subscriptionId: sub.id, reason: data.reason },
      {
        resourceType: 'subscription',
        resourceId: sub.id,
      }
    );
  }

  async function handleSubscriptionUpdated({ tx, providerName, data }) {
    if (!data.subscriptionId) return;
    const sub = await queries.findSubscriptionById(data.subscriptionId);
    if (!sub) return;

    const updates = {};
    if (data.status === 'canceled') updates.status = SUBSCRIPTION_STATUS.CANCELED;
    if (data.status === 'past_due') updates.status = SUBSCRIPTION_STATUS.PAST_DUE;

    if (Object.keys(updates).length > 0) {
      await queries.updateSubscription(sub.id, updates);
    }
  }

  async function handleRefundCompleted({ tx, providerName, data }) {
    if (!data.refundReference) return;
    // In a full impl, we'd find the refund by reference and update it
    logger.info({ data }, 'Refund completed webhook handled');
  }

  /* ===========================================================================
   * EXPORTS
   * ======================================================================== */

  return {
    // Plans
    listPlans,
    getPlan,

    // Checkout
    createCheckoutSession,

    // Subscriptions
    getActiveSubscriptionForScope,
    listSubscriptionsForScope,
    listEntitlementsForScope,
    checkEntitlement,
    recordUsage,
    cancelSubscription,

    // Payments / invoices
    listPaymentsForScope,
    listInvoicesForScope,
    getInvoice,

    // Refunds
    requestRefund,
    listRefunds,

    // Webhooks
    handleProviderWebhook,
  };
}

export default createBillingService;