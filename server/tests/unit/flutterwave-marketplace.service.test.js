import assert from 'node:assert/strict';
import test from 'node:test';

import { createFlutterwaveMarketplaceService } from '../../src/modules/marketplace/flutterwave-marketplace.service.js';

const config = {
  app: { url: 'https://syncexc.test' },
  marketplace: { platformFeePercent: 2 },
  payments: {
    flutterwave: {
      enabled: true,
      secretKey: 'test-secret',
      webhookSecret: 'test-webhook-hash',
    },
  },
};

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return { status: 'success', data };
    },
  };
}

test('creates a recurring Flutterwave checkout and stores provider references without activating access', async () => {
  const transaction = {};
  const requests = [];
  const storedSubscription = [];
  const plan = {
    id: 'plan-1',
    name: 'Monthly',
    pricing: { amountMinor: 1250, currency: 'NGN', billingInterval: 'monthly' },
  };
  const service = createFlutterwaveMarketplaceService({
    db: {
      async tx(callback) { return callback(transaction); },
      async query() { return { rows: [{ email: 'subscriber@example.test' }] }; },
    },
    queries: {
      async findPendingSubscription() { return null; },
      async insertSubscription(client, data) {
        assert.equal(client, transaction);
        assert.equal(data.billingProvider, 'flutterwave');
        return { id: 'subscription-1' };
      },
      async insertSubscriptionEvent() {},
      async updateProviderPlanFlutterwaveId(id, paymentPlanId) {
        assert.equal(id, plan.id);
        return { flutterwave_payment_plan_id: paymentPlanId };
      },
      async insertMarketplaceFlutterwaveCheckoutReference(client, input) {
        assert.equal(client, transaction);
        assert.equal(input.subscriptionId, 'subscription-1');
        assert.match(input.reference, /^subscription-1-/);
      },
      async updateMarketplaceSubscription(id, fields) {
        storedSubscription.push({ id, fields });
      },
    },
    providerService: {},
    config,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/payment-plans')) return jsonResponse({ id: 987 });
      return jsonResponse({ link: 'https://checkout.flutterwave.test/session' });
    },
  });

  const result = await service.createSubscriptionCheckout({
    userId: 'subscriber-1',
    provider: { id: 'provider-1', display_name: 'Trader One' },
    plan,
    workspaceId: 'workspace-1',
  });

  assert.equal(result.subscriptionId, 'subscription-1');
  assert.equal(result.redirectUrl, 'https://checkout.flutterwave.test/session');
  const checkout = JSON.parse(requests[1].options.body);
  assert.equal(checkout.payment_plan, 987);
  assert.equal(checkout.amount, 12.5);
  assert.equal(checkout.currency, 'NGN');
  assert.equal(checkout.customer.email, 'subscriber@example.test');
  assert.equal(checkout.meta.marketplaceSubscriptionId, 'subscription-1');
  assert.equal(storedSubscription[0].fields.status, undefined);
  assert.equal(storedSubscription[0].fields.billingProvider, 'flutterwave');
  assert.equal(storedSubscription[0].fields.flutterwavePaymentPlanId, '987');
});

test('creates a fresh Flutterwave checkout link when retrying a pending subscription', async () => {
  const transaction = {};
  const references = [];
  const updates = [];
  const requests = [];
  const service = createFlutterwaveMarketplaceService({
    db: {
      async tx(callback) { return callback(transaction); },
      async query() { return { rows: [{ email: 'subscriber@example.test' }] }; },
    },
    queries: {
      async findPendingSubscription() {
        return {
          id: 'subscription-1',
          plan_id: 'plan-1',
          billing_provider: 'flutterwave',
          flutterwave_checkout_url: 'https://checkout.flutterwave.test/expired',
        };
      },
      async insertMarketplaceFlutterwaveCheckoutReference(client, input) {
        assert.equal(client, transaction);
        references.push(input);
      },
      async updateMarketplaceSubscription(id, fields) {
        updates.push({ id, fields });
      },
    },
    providerService: {},
    config,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({ link: 'https://checkout.flutterwave.test/fresh-session' });
    },
  });

  const result = await service.createSubscriptionCheckout({
    userId: 'subscriber-1',
    provider: { id: 'provider-1', display_name: 'Trader One' },
    plan: {
      id: 'plan-1',
      name: 'Monthly',
      flutterwave_payment_plan_id: '987',
      pricing: { amountMinor: 1250, currency: 'NGN', billingInterval: 'monthly' },
    },
    workspaceId: 'workspace-1',
  });

  assert.equal(result.subscriptionId, 'subscription-1');
  assert.equal(result.redirectUrl, 'https://checkout.flutterwave.test/fresh-session');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.flutterwave.com/v3/payments');
  assert.match(references[0].reference, /^subscription-1-/);
  assert.equal(references[0].subscriptionId, 'subscription-1');
  assert.equal(updates.at(-1).fields.flutterwaveCheckoutUrl, 'https://checkout.flutterwave.test/fresh-session');
});

test('verifies successful recurring charges and records net Trader earnings idempotently', async () => {
  const transaction = {};
  const savedEarnings = [];
  const updates = [];
  const events = [];
  const queries = {
    async findSubscriptionByFlutterwaveReference(reference) {
      assert.equal(reference, 'subscription-1-checkout');
      return {
        id: 'subscription-1',
        provider_id: 'provider-1',
        subscriber_user_id: 'subscriber-1',
        plan_pricing: { amountMinor: 10000, currency: 'NGN', billingInterval: 'monthly' },
      };
    },
    async insertMarketplaceFlutterwaveWebhookEvent(client, input) {
      assert.equal(client, transaction);
      events.push(input);
      return { event_id: input.eventId };
    },
    async insertMarketplaceTraderEarning(client, earning) {
      assert.equal(client, transaction);
      savedEarnings.push(earning);
      return { id: 'earning-1' };
    },
    async expireActiveFreeSubscriptions(client, input) {
      assert.equal(client, transaction);
      assert.deepEqual(input, {
        providerId: 'provider-1',
        subscriberUserId: 'subscriber-1',
        exceptSubscriptionId: 'subscription-1',
      });
      return [];
    },
    async updateMarketplaceSubscription(id, fields, client) {
      assert.equal(client, transaction);
      updates.push({ id, fields });
    },
    async insertSubscriptionEvent(client, event) {
      assert.equal(client, transaction);
      events.push(event);
    },
  };
  const service = createFlutterwaveMarketplaceService({
    db: { async tx(callback) { return callback(transaction); } },
    queries,
    providerService: {},
    config,
    fetchImpl: async (url) => {
      if (url.includes('/transactions/')) {
        return jsonResponse({
          id: 77,
          tx_ref: 'subscription-1-checkout',
          status: 'successful',
          amount: 100,
          currency: 'NGN',
          created_at: '2026-11-03T10:00:00.000Z',
          customer: { id: 123 },
        });
      }
      return jsonResponse([{ id: 456, status: 'active', plan: 987, customer: { id: 123 } }]);
    },
  });

  const result = await service.handleWebhook({
    event: {
      event: 'charge.completed',
      data: { id: 77, status: 'successful' },
    },
  });

  assert.deepEqual(result, { handled: true, duplicate: false });
  assert.deepEqual(savedEarnings[0], {
    providerId: 'provider-1',
    subscriptionId: 'subscription-1',
    paymentReference: '77',
    grossAmountMinor: 10000,
    platformFeeMinor: 200,
    traderNetAmountMinor: 9800,
    currency: 'NGN',
  });
  assert.equal(updates[0].fields.status, 'active');
  assert.equal(updates[0].fields.flutterwaveCustomerId, '123');
  assert.equal(updates[0].fields.flutterwaveSubscriptionId, '456');
  assert.equal(events[0].eventId, 'charge.completed:77');
});

test('confirms checkout return payments only for the owning subscriber and records the verified payment', async () => {
  const transaction = {};
  const updates = [];
  const savedEarnings = [];
  const warnings = [];
  const queries = {
    async findSubscriptionById(id) {
      assert.equal(id, 'subscription-1');
      return { id, subscriber_user_id: 'subscriber-1' };
    },
    async findSubscriptionByFlutterwaveReference(reference) {
      assert.equal(reference, 'subscription-1-checkout');
      return {
        id: 'subscription-1',
        provider_id: 'provider-1',
        subscriber_user_id: 'subscriber-1',
        plan_pricing: { amountMinor: 10000, currency: 'NGN', billingInterval: 'monthly' },
      };
    },
    async insertMarketplaceFlutterwaveWebhookEvent(client) {
      assert.equal(client, transaction);
      return { event_id: 'charge.completed:77' };
    },
    async insertMarketplaceTraderEarning(_client, earning) {
      savedEarnings.push(earning);
      return { id: 'earning-1' };
    },
    async expireActiveFreeSubscriptions() { return []; },
    async updateMarketplaceSubscription(_id, fields) { updates.push(fields); },
    async insertSubscriptionEvent() {},
  };
  const service = createFlutterwaveMarketplaceService({
    db: { async tx(callback) { return callback(transaction); } },
    queries,
    providerService: {},
    config,
    logger: { warn: (...args) => warnings.push(args) },
    fetchImpl: async (url) => {
      if (url.includes('/transactions/')) {
        return jsonResponse({
          id: 77,
          tx_ref: 'subscription-1-checkout',
          status: 'successful',
          amount: 100,
          currency: 'NGN',
          created_at: '2026-11-03T10:00:00.000Z',
        });
      }
      throw new Error('Flutterwave subscription lookup is unavailable');
    },
  });

  const result = await service.confirmCheckoutPayment({
    userId: 'subscriber-1',
    subscriptionId: 'subscription-1',
    transactionId: '77',
  });

  assert.deepEqual(result, { handled: true, duplicate: false });
  assert.equal(updates[0].status, 'active');
  assert.equal(savedEarnings[0].grossAmountMinor, 10000);
  assert.equal(warnings.length, 1);
});

test('rejects a successful charge whose amount differs from the active plan', async () => {
  const service = createFlutterwaveMarketplaceService({
    db: { async tx(callback) { return callback({}); } },
    queries: {
      async findSubscriptionByFlutterwaveReference() {
        return {
          id: 'subscription-1',
          provider_id: 'provider-1',
          plan_pricing: { amountMinor: 10000, currency: 'NGN', billingInterval: 'monthly' },
        };
      },
    },
    providerService: {},
    config,
    fetchImpl: async (url) => url.includes('/transactions/')
      ? jsonResponse({
        id: 77,
        tx_ref: 'subscription-1-checkout',
        status: 'successful',
        amount: 99,
        currency: 'NGN',
      })
      : jsonResponse([]),
  });

  await assert.rejects(
    service.handleWebhook({
      event: { event: 'charge.completed', data: { id: 77 } },
    }),
    { code: 'PAYMENT_AMOUNT_MISMATCH' },
  );
});

test('maps failed recurring charges by provider subscription ID and marks the subscription past due', async () => {
  const transaction = {};
  const updates = [];
  const events = [];
  const queries = {
    async findSubscriptionByFlutterwaveReference() {
      return null;
    },
    async findSubscriptionByFlutterwaveId(id) {
      assert.equal(id, '456');
      return { id: 'subscription-1' };
    },
    async insertMarketplaceFlutterwaveWebhookEvent(client, input) {
      assert.equal(client, transaction);
      events.push(input);
      return { event_id: input.eventId };
    },
    async updateMarketplaceSubscription(id, fields, client) {
      assert.equal(client, transaction);
      updates.push({ id, fields });
    },
    async insertSubscriptionEvent(client, input) {
      assert.equal(client, transaction);
      events.push(input);
    },
  };
  const service = createFlutterwaveMarketplaceService({
    db: { async tx(callback) { return callback(transaction); } },
    queries,
    providerService: {},
    config,
    fetchImpl: async (url) => {
      if (url.includes('/transactions/')) {
        return jsonResponse({
          id: 78,
          tx_ref: 'provider-generated-renewal-reference',
          status: 'failed',
        });
      }
      return jsonResponse([{ id: 456, status: 'active', plan: 987, customer: { id: 123 } }]);
    },
  });

  const result = await service.handleWebhook({
    event: { event: 'charge.completed', data: { id: 78, status: 'failed' } },
  });

  assert.deepEqual(result, { handled: true, duplicate: false });
  assert.equal(updates[0].id, 'subscription-1');
  assert.equal(updates[0].fields.status, 'past_due');
  assert.equal(events[0].eventId, 'charge.completed:78');
  assert.equal(events[1].eventType, 'payment_failed');
});
