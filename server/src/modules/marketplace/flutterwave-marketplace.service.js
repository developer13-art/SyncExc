/**
 * SyncExc Server — Flutterwave marketplace billing and earnings
 */

import { randomUUID } from 'node:crypto';
import {
  ConflictError,
  ExternalProviderError,
  NotFoundError,
} from '../../lib/errors.js';
import { decrypt, encrypt } from '../../lib/crypto.js';

const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';
const BILLING_INTERVALS = {
  monthly: 'monthly',
  yearly: 'yearly',
};

export function createFlutterwaveMarketplaceService({
  db,
  queries,
  providerService,
  config,
  logger,
  fetchImpl = fetch,
}) {
  function getFlutterwaveConfig() {
    const flutterwave = config?.payments?.flutterwave;
    if (!flutterwave?.enabled || !flutterwave.secretKey) {
      throw new ConflictError('Flutterwave marketplace billing is not configured', 'FLUTTERWAVE_NOT_CONFIGURED');
    }
    return flutterwave;
  }

  async function requestFlutterwave(path, { method = 'GET', body } = {}) {
    const { secretKey } = getFlutterwaveConfig();
    let response;
    try {
      response = await fetchImpl(`${FLUTTERWAVE_API_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ExternalProviderError('Flutterwave could not be reached. Please try again later.', {
        provider: 'flutterwave',
        retryable: true,
        details: { stage: path },
      });
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new ExternalProviderError('Flutterwave returned an invalid response.', {
        provider: 'flutterwave',
        retryable: response.status >= 500,
        details: { stage: path, providerStatus: response.status },
      });
    }
    if (!response.ok || result?.status !== 'success') {
      logger?.error?.({
        provider: 'flutterwave',
        status: response.status,
        providerMessage: result?.message,
        stage: path,
      }, 'Flutterwave marketplace request failed');
      throw new ExternalProviderError('Flutterwave could not complete the marketplace payment request.', {
        provider: 'flutterwave',
        retryable: response.status >= 500,
        details: { stage: path, providerStatus: response.status },
      });
    }
    return result.data;
  }

  async function ensurePaymentPlan(plan) {
    if (plan.flutterwave_payment_plan_id) return plan.flutterwave_payment_plan_id;
    const interval = BILLING_INTERVALS[plan.pricing?.billingInterval];
    const amountMinor = Number(plan.pricing?.amountMinor);
    const currency = plan.pricing?.currency?.toUpperCase();
    if (!interval || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 ||
      !['NGN', 'USD'].includes(currency)) {
      throw new ConflictError('The subscription plan has unsupported Flutterwave pricing', 'INVALID_PLAN_PRICING');
    }

    const created = await requestFlutterwave('/payment-plans', {
      method: 'POST',
      body: {
        amount: amountMinor / 100,
        name: `SyncExc ${plan.name}`.slice(0, 100),
        interval,
        currency,
      },
    });
    if (!created?.id) {
      throw new ExternalProviderError('Flutterwave returned an incomplete payment plan.', {
        provider: 'flutterwave',
        retryable: false,
        details: { stage: 'payment plan creation' },
      });
    }
    const savedPlan = await queries.updateProviderPlanFlutterwaveId(plan.id, String(created.id));
    return savedPlan?.flutterwave_payment_plan_id || String(created.id);
  }

  async function createSubscriptionCheckout({ userId, provider, plan, workspaceId }) {
    const flutterwave = getFlutterwaveConfig();
    if (!flutterwave.webhookSecret) {
      throw new ConflictError('Flutterwave marketplace webhook verification is not configured', 'FLUTTERWAVE_WEBHOOK_NOT_CONFIGURED');
    }

    const existing = await queries.findPendingSubscription(provider.id, userId);
    let subscription = existing;
    if (existing) {
      if (existing.plan_id !== plan.id) {
        throw new ConflictError('Another subscription checkout is already pending', 'CHECKOUT_IN_PROGRESS');
      }
      if (existing.billing_provider && existing.billing_provider !== 'flutterwave') {
        throw new ConflictError('Finish or cancel the existing payment-provider checkout before retrying', 'CHECKOUT_IN_PROGRESS');
      }
    }

    if (!subscription) {
      try {
        subscription = await db.tx(async (tx) => {
          const created = await queries.insertSubscription(tx, {
            providerId: provider.id,
            planId: plan.id,
            subscriberUserId: userId,
            workspaceId,
            billingProvider: 'flutterwave',
          });
          await queries.insertSubscriptionEvent(tx, {
            subscriptionId: created.id,
            eventType: 'checkout_started',
            metadata: { planId: plan.id, billingProvider: 'flutterwave' },
          });
          return created;
        });
      } catch (error) {
        if (error.code !== '23505') throw error;
        const pending = await queries.findPendingSubscription(provider.id, userId);
        if (pending?.plan_id === plan.id && pending.flutterwave_checkout_url) {
          return { subscriptionId: pending.id, redirectUrl: pending.flutterwave_checkout_url };
        }
        throw new ConflictError('Another subscription checkout is already being prepared', 'CHECKOUT_IN_PROGRESS');
      }
    }

    const interval = BILLING_INTERVALS[plan.pricing?.billingInterval];
    const amountMinor = Number(plan.pricing?.amountMinor);
    const currency = plan.pricing?.currency?.toUpperCase();
    if (!interval || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 ||
      !['NGN', 'USD'].includes(currency)) {
      throw new ConflictError('The subscription plan has unsupported Flutterwave pricing', 'INVALID_PLAN_PRICING');
    }

    const emailResult = await db.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    const subscriberEmail = emailResult.rows[0]?.email;
    if (!subscriberEmail) {
      throw new ConflictError('A valid account email is required to start checkout', 'SUBSCRIBER_EMAIL_REQUIRED');
    }
    const paymentPlanId = await ensurePaymentPlan(plan);
    const checkoutReference = `${subscription.id}-${randomUUID()}`;
    const baseUrl = config.app.url.replace(/\/+$/, '');
    await db.tx(async (tx) => {
      await queries.insertMarketplaceFlutterwaveCheckoutReference(tx, {
        reference: checkoutReference,
        subscriptionId: subscription.id,
      });
      await queries.updateMarketplaceSubscription(subscription.id, {
        billingProvider: 'flutterwave',
        flutterwaveCheckoutReference: checkoutReference,
        flutterwavePaymentPlanId: paymentPlanId,
      }, tx);
    });
    let checkout;
    try {
      checkout = await requestFlutterwave('/payments', {
        method: 'POST',
        body: {
          tx_ref: checkoutReference,
          amount: amountMinor / 100,
          currency,
          payment_plan: Number(paymentPlanId),
          redirect_url: `${baseUrl}/app/marketplace/subscriptions?checkout=success&subscriptionId=${subscription.id}`,
          customer: { email: subscriberEmail },
          customizations: {
            title: 'SyncExc Marketplace',
            description: `${provider.display_name} — ${plan.name}`,
          },
          meta: {
            marketplaceSubscriptionId: subscription.id,
            providerId: provider.id,
            planId: plan.id,
          },
        },
      });
    } catch (error) {
      await db.tx(async (tx) => {
        await queries.updateMarketplaceSubscription(subscription.id, { status: 'expired' }, tx);
        await queries.insertSubscriptionEvent(tx, {
          subscriptionId: subscription.id,
          eventType: 'checkout_failed',
          metadata: { billingProvider: 'flutterwave' },
        });
      });
      throw error;
    }
    if (!checkout?.link) {
      throw new ExternalProviderError('Flutterwave returned an incomplete checkout session.', {
        provider: 'flutterwave',
        retryable: false,
        details: { stage: 'checkout initialization' },
      });
    }
    await queries.updateMarketplaceSubscription(subscription.id, {
      flutterwaveCheckoutUrl: checkout.link,
    });
    return { subscriptionId: subscription.id, redirectUrl: checkout.link };
  }

  async function cancelPaidSubscription(subscription) {
    if (!subscription.flutterwave_subscription_id) {
      throw new ConflictError(
        'Flutterwave has not returned the recurring subscription ID yet. Try again after the first payment is confirmed.',
        'FLUTTERWAVE_SUBSCRIPTION_NOT_READY'
      );
    }
    await requestFlutterwave(`/subscriptions/${encodeURIComponent(subscription.flutterwave_subscription_id)}/cancel`, {
      method: 'PUT',
    });
    return queries.updateMarketplaceSubscription(subscription.id, {
      status: 'canceled',
      canceledAt: new Date(),
    });
  }

  async function processSuccessfulCharge(verified, { subscriptionId, userId } = {}) {
    const subscriptionFromReference = verified.tx_ref
      ? await queries.findSubscriptionByFlutterwaveReference(verified.tx_ref)
      : null;
    let providerSubscription = null;
    try {
      providerSubscription = await findProviderSubscriptionForTransaction(verified);
    } catch (error) {
      if (!subscriptionFromReference) throw error;
      logger?.warn?.({
        transactionId: verified.id,
        error,
      }, 'Flutterwave subscription lookup failed after a verifiable marketplace payment');
    }
    const subscription = subscriptionFromReference
      || await findMarketplaceSubscription(verified, providerSubscription);
    if (!subscription) {
      logger?.error?.({
        transactionId: verified.id,
        transactionReference: verified.tx_ref,
        planId: providerSubscription?.plan,
      }, 'Flutterwave charge did not match a marketplace subscription');
      throw new ExternalProviderError('Flutterwave payment could not be matched to a marketplace subscription.', {
        provider: 'flutterwave',
        retryable: true,
        details: { stage: 'subscription matching' },
      });
    }
    if (
      (subscriptionId && subscription.id !== subscriptionId) ||
      (userId && subscription.subscriber_user_id !== userId)
    ) {
      throw new ConflictError('Flutterwave payment does not match this subscription', 'PAYMENT_SUBSCRIPTION_MISMATCH');
    }
    if (verified.currency?.toUpperCase() !== subscription.plan_pricing?.currency?.toUpperCase()) {
      throw new ConflictError('Flutterwave payment currency does not match the subscription plan', 'PAYMENT_CURRENCY_MISMATCH');
    }
    const amountMinor = Math.round(Number(verified.amount) * 100);
    if (amountMinor !== Number(subscription.plan_pricing?.amountMinor)) {
      throw new ConflictError('Flutterwave payment amount does not match the subscription plan', 'PAYMENT_AMOUNT_MISMATCH');
    }

    return db.tx(async (tx) => {
      const eventId = `charge.completed:${verified.id}`;
      const inserted = await queries.insertMarketplaceFlutterwaveWebhookEvent(tx, {
        eventId,
        eventType: 'charge.completed',
      });
      if (!inserted) return { handled: true, duplicate: true };

      const feePercent = Number(config?.marketplace?.platformFeePercent ?? 2);
      const platformFeeMinor = Math.round(amountMinor * feePercent / 100);
      const earning = await queries.insertMarketplaceTraderEarning(tx, {
        providerId: subscription.provider_id,
        subscriptionId: subscription.id,
        paymentReference: String(verified.id),
        grossAmountMinor: amountMinor,
        platformFeeMinor,
        traderNetAmountMinor: amountMinor - platformFeeMinor,
        currency: verified.currency.toUpperCase(),
      });
      const replacedFreeSubscriptions = await queries.expireActiveFreeSubscriptions(tx, {
        providerId: subscription.provider_id,
        subscriberUserId: subscription.subscriber_user_id,
        exceptSubscriptionId: subscription.id,
      });
      for (const replaced of replacedFreeSubscriptions) {
        await queries.insertSubscriptionEvent(tx, {
          subscriptionId: replaced.id,
          eventType: 'subscription_upgraded',
          metadata: {
            billingProvider: 'flutterwave',
            replacementSubscriptionId: subscription.id,
          },
        });
      }
      const periodStart = verified.created_at ? new Date(verified.created_at) : new Date();
      const periodEnd = nextBillingDate(periodStart, subscription.plan_pricing?.billingInterval);
      await queries.updateMarketplaceSubscription(subscription.id, {
        status: 'active',
        billingProvider: 'flutterwave',
        flutterwaveCustomerId: verified.customer?.id ? String(verified.customer.id) : null,
        flutterwaveSubscriptionId: providerSubscription?.id
          ? String(providerSubscription.id)
          : null,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      }, tx);
      await queries.insertSubscriptionEvent(tx, {
        subscriptionId: subscription.id,
        eventType: 'payment_succeeded',
        metadata: {
          billingProvider: 'flutterwave',
          paymentReference: String(verified.id),
          earningsRecordId: earning?.id || null,
        },
      });
      return { handled: true, duplicate: false };
    });
  }

  async function confirmCheckoutPayment({ userId, subscriptionId, transactionId }) {
    const subscription = await queries.findSubscriptionById(subscriptionId);
    if (!subscription || subscription.subscriber_user_id !== userId) {
      throw new NotFoundError('Subscription');
    }
    const verified = await verifyTransaction(transactionId);
    if (verified.status !== 'successful') {
      throw new ConflictError('Flutterwave has not confirmed this payment', 'PAYMENT_NOT_SUCCESSFUL');
    }
    return processSuccessfulCharge(verified, { subscriptionId, userId });
  }

  async function handleWebhook({ event }) {
    const eventType = event?.event;
    const data = event?.data;
    if (!eventType || !data || typeof data !== 'object') {
      throw new ConflictError('Invalid Flutterwave webhook event', 'INVALID_WEBHOOK_EVENT');
    }

    if (eventType === 'charge.completed') {
      const verified = await verifyTransaction(data.id);
      if (verified.status !== 'successful') {
        return handleFailedCharge(eventType, verified);
      }
      return processSuccessfulCharge(verified);
    }

    if (eventType === 'subscription.cancelled') {
      const providerSubscriptionId = data.id ? String(data.id) : null;
      const eventId = `subscription.cancelled:${providerSubscriptionId || data.plan || 'unknown'}`;
      return db.tx(async (tx) => {
        const inserted = await queries.insertMarketplaceFlutterwaveWebhookEvent(tx, {
          eventId,
          eventType,
        });
        if (!inserted) return { handled: true, duplicate: true };
        const subscription = providerSubscriptionId
          ? await queries.findSubscriptionByFlutterwaveId(providerSubscriptionId, tx)
          : null;
        if (subscription) {
          await queries.updateMarketplaceSubscription(subscription.id, {
            status: 'canceled',
            canceledAt: new Date(),
          }, tx);
          await queries.insertSubscriptionEvent(tx, {
            subscriptionId: subscription.id,
            eventType: 'subscription_cancelled',
            metadata: { billingProvider: 'flutterwave' },
          });
        }
        return { handled: true, duplicate: false };
      });
    }

    return { handled: false, ignored: true };
  }

  async function verifyTransaction(transactionId) {
    if (!Number.isSafeInteger(Number(transactionId)) || Number(transactionId) <= 0) {
      throw new ConflictError('Invalid Flutterwave transaction ID', 'INVALID_WEBHOOK_EVENT');
    }
    const result = await requestFlutterwave(`/transactions/${Number(transactionId)}/verify`);
    if (String(result?.id) !== String(transactionId)) {
      throw new ConflictError('Flutterwave transaction verification returned a different transaction', 'PAYMENT_VERIFICATION_FAILED');
    }
    return result;
  }

  async function findProviderSubscriptionForTransaction(transaction) {
    const rows = await requestFlutterwave(`/subscriptions?transaction_id=${encodeURIComponent(transaction.id)}`);
    const subscriptions = Array.isArray(rows) ? rows : rows ? [rows] : [];
    return subscriptions.find((item) =>
      item.status === 'active' || item.status === 'cancelled'
    ) || subscriptions[0] || null;
  }

  async function findMarketplaceSubscription(transaction, providerSubscription) {
    if (transaction.tx_ref) {
      const byReference = await queries.findSubscriptionByFlutterwaveReference(transaction.tx_ref);
      if (byReference) return byReference;
    }
    if (providerSubscription?.id) {
      const byProviderId = await queries.findSubscriptionByFlutterwaveId(String(providerSubscription.id));
      if (byProviderId) return byProviderId;
    }
    const planId = providerSubscription?.plan ?? transaction.payment_plan ?? transaction.plan;
    const customerId = providerSubscription?.customer?.id ?? transaction.customer?.id;
    if (planId && customerId) {
      return queries.findSubscriptionByFlutterwavePlanCustomer(String(planId), String(customerId));
    }
    return null;
  }

  async function handleFailedCharge(eventType, transaction) {
    const subscriptionFromReference = transaction.tx_ref
      ? await queries.findSubscriptionByFlutterwaveReference(transaction.tx_ref)
      : null;
    const providerSubscription = subscriptionFromReference
      ? null
      : await findProviderSubscriptionForTransaction(transaction);
    const subscription = subscriptionFromReference
      || await findMarketplaceSubscription(transaction, providerSubscription);
    return db.tx(async (tx) => {
      const inserted = await queries.insertMarketplaceFlutterwaveWebhookEvent(tx, {
        eventId: `${eventType}:${transaction.id}`,
        eventType,
      });
      if (!inserted) return { handled: true, duplicate: true };
      if (subscription) {
        await queries.updateMarketplaceSubscription(subscription.id, { status: 'past_due' }, tx);
        await queries.insertSubscriptionEvent(tx, {
          subscriptionId: subscription.id,
          eventType: 'payment_failed',
          metadata: {
            billingProvider: 'flutterwave',
            paymentReference: String(transaction.id),
          },
        });
      }
      return { handled: true, duplicate: false };
    });
  }

  async function getMyEarnings({ userId, workspaceId, limit = 50, offset = 0 }) {
    const provider = await providerService.getManagedProvider({ userId, workspaceId });
    const [earnings, payoutRequests] = await Promise.all([
      queries.listMarketplaceTraderEarnings(provider.id, { limit, offset }),
      queries.listMarketplaceTraderPayoutRequests(provider.id),
    ]);
    return { ...earnings, payoutRequests };
  }

  async function requestPayout({
    userId,
    workspaceId,
    currency,
    accountName,
    bankName,
    countryCode,
    accountNumber,
  }) {
    const provider = await providerService.getManagedProvider({ userId, workspaceId });
    try {
      const request = await db.tx((tx) => queries.createMarketplaceTraderPayoutRequest(tx, {
        providerId: provider.id,
        requestedBy: userId,
        currency: currency.toUpperCase(),
        accountName: accountName.trim(),
        bankName: bankName.trim(),
        countryCode: countryCode.toUpperCase(),
        encryptedAccountNumber: encrypt(accountNumber.trim()),
        accountLast4: accountNumber.trim().slice(-4),
      }));
      if (!request) {
        throw new ConflictError('There is no available balance to request for this currency', 'NO_PAYOUT_BALANCE');
      }
      const safeRequest = { ...request };
      delete safeRequest.payout_account_encrypted;
      return safeRequest;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictError('A payout request is already pending for this currency', 'PAYOUT_REQUEST_PENDING');
      }
      throw error;
    }
  }

  async function listMyPayoutRequests({ userId, workspaceId }) {
    const provider = await providerService.getManagedProvider({ userId, workspaceId });
    return queries.listMarketplaceTraderPayoutRequests(provider.id);
  }

  async function listAdminEarnings({ status, limit = 50, offset = 0 }) {
    return queries.listMarketplaceTraderEarningsForAdmin({ status, limit, offset });
  }

  async function listAdminPayoutRequests({ status, limit = 50, offset = 0 }) {
    const result = await queries.listMarketplaceTraderPayoutRequestsForAdmin({ status, limit, offset });
    return {
      ...result,
      items: result.items.map(({ payout_account_encrypted: encryptedAccount, ...request }) => ({
        ...request,
        payout_account_number: encryptedAccount ? decrypt(encryptedAccount) : null,
      })),
    };
  }

  async function listAdminSubscriptions({ limit = 50, offset = 0 }) {
    return queries.listMarketplaceTraderSubscriptionsForAdmin({ limit, offset });
  }

  async function markPayoutRequestPaid({ requestId, actorId, payoutReference, note }) {
    const updated = await db.tx((tx) => queries.markMarketplaceTraderPayoutRequestPaid(tx, {
      requestId,
      actorId,
      payoutReference,
      note,
    }));
    if (updated) return updated;
    throw new ConflictError('This payout request is no longer pending or has no payable earnings', 'PAYOUT_REQUEST_NOT_PENDING');
  }

  async function rejectPayoutRequest({ requestId, actorId, note }) {
    const updated = await db.tx((tx) => queries.rejectMarketplaceTraderPayoutRequest(tx, {
      requestId,
      actorId,
      note,
    }));
    if (updated) return updated;
    throw new ConflictError('This payout request is no longer pending', 'PAYOUT_REQUEST_NOT_PENDING');
  }

  async function markEarningPaid({ earningId, actorId, payoutReference, note }) {
    const updated = await db.tx((tx) => queries.markMarketplaceTraderEarningPaid(tx, {
      earningId,
      actorId,
      payoutReference,
      note,
    }));
    if (updated) return updated;
    const current = await queries.findMarketplaceTraderEarningById(earningId);
    if (!current) throw new NotFoundError('Trader earning');
    throw new ConflictError('Only pending Trader earnings can be marked as paid', 'EARNING_NOT_PENDING');
  }

  return {
    createSubscriptionCheckout,
    cancelPaidSubscription,
    confirmCheckoutPayment,
    handleWebhook,
    getMyEarnings,
    requestPayout,
    listMyPayoutRequests,
    listAdminEarnings,
    listAdminPayoutRequests,
    listAdminSubscriptions,
    markPayoutRequestPaid,
    rejectPayoutRequest,
    markEarningPaid,
  };
}

function nextBillingDate(start, interval) {
  const end = new Date(start);
  if (interval === 'yearly') {
    const day = end.getUTCDate();
    end.setUTCDate(1);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    end.setUTCDate(Math.min(day, daysInUtcMonth(end)));
    return end;
  }
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(Math.min(day, daysInUtcMonth(end)));
  return end;
}

function daysInUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export default createFlutterwaveMarketplaceService;
