import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMarketplaceController } from '../../src/modules/marketplace/marketplace.controller.js';
import {
  serializeProvider,
  serializeProviderSubscriber,
  serializeMarketplaceSubscription,
  serializePublishedSignal,
} from '../../src/lib/serializers.js';
import { createPublicationService } from '../../src/modules/marketplace/publication.service.js';
import { createProviderService } from '../../src/modules/marketplace/provider.service.js';
import { createSubscriptionService } from '../../src/modules/marketplace/subscription.service.js';
import { createMarketplaceQueries } from '../../src/modules/marketplace/marketplace.queries.js';
import { createCopyConfigurationService } from '../../src/modules/marketplace/copy-configuration.service.js';
import { createCopyOrchestrationService } from '../../src/modules/marketplace/copy-orchestration.service.js';
import { createStripeMarketplaceService } from '../../src/modules/marketplace/stripe-marketplace.service.js';
import { PublishSignalRequestSchema } from '@syncexc/shared';
import { createMarketplaceListeners } from '../../src/modules/marketplace/listeners.js';
import { createSignalDiscussionService } from '../../src/modules/marketplace/signal-discussion.service.js';

function createResponse() {
  return {
    req: { headers: {} },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('Trader Studio API', () => {
  it('requires a second explicit confirmation for terminal risk approval and records the submitted order', async () => {
    const record = {
      id: 'record-1',
      subscriber_user_id: 'subscriber-1',
      outcome: 'held',
      copy_intent_id: 'intent-1',
      intent_status: 'awaiting_confirmation',
      intent_payload: {
        connectionId: 'connection-1',
        accountId: 'account-1',
        instrumentId: 'BTCUSDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        quantity: '0.01',
        idempotencyKey: 'copy-submit-key',
      },
    };
    let terminalConfirmationCalls = 0;
    let submitCalls = 0;
    const queries = {
      async findCopyRecordForConfirmation() { return record; },
      async claimCopyExecutionIntent(_intentId, expectedStatus) {
        if (record.intent_status !== expectedStatus) return null;
        record.intent_status = 'confirming';
        return {
          intent_payload: record.intent_payload,
          status: 'confirming',
        };
      },
      async updateCopyExecutionIntent(_intentId, { status, payload }) {
        record.intent_status = status;
        if (payload) record.intent_payload = payload;
      },
      async updateCopyProcessingRecord(_id, changes) {
        Object.assign(record, changes);
      },
      async updateCopyDestinationResult() {},
    };
    const service = createCopyOrchestrationService({
      db: { async tx(callback) { return callback({}); } },
      queries,
      terminal: {
        async submitOrder() {
          submitCalls += 1;
          return {
            requiresConfirmation: true,
            executionRequest: { id: 'execution-request-1' },
          };
        },
        async confirmExecution({ executionRequestId }) {
          terminalConfirmationCalls += 1;
          assert.equal(executionRequestId, 'execution-request-1');
          return { order: { id: 'order-1', status: 'submitted' } };
        },
      },
    });

    const firstResult = await service.confirmRecord({
      userId: 'subscriber-1',
      workspaceId: 'workspace-1',
      recordId: 'record-1',
    });
    assert.deepEqual(firstResult, {
      status: 'terminal_confirmation_required',
      executionRequestId: 'execution-request-1',
    });
    assert.equal(record.outcome, 'held');
    assert.equal(record.intent_status, 'terminal_confirmation_required');

    await assert.rejects(
      service.confirmRecord({
        userId: 'subscriber-1',
        workspaceId: 'workspace-1',
        recordId: 'record-1',
      }),
      { code: 'PERMISSION_DENIED' },
    );
    assert.equal(terminalConfirmationCalls, 0);

    const finalResult = await service.confirmRecord({
      userId: 'subscriber-1',
      workspaceId: 'workspace-1',
      recordId: 'record-1',
      canApproveExecution: true,
    });
    assert.deepEqual(finalResult, { status: 'submitted', orderId: 'order-1' });
    assert.equal(submitCalls, 1);
    assert.equal(terminalConfirmationCalls, 1);
    assert.equal(record.outcome, 'executed');
    assert.equal(record.intent_status, 'submitted');
  });

  it('submits a user-confirmed signal to the active selected copy configuration', async () => {
    const record = {
      id: 'record-1',
      subscriber_user_id: 'subscriber-1',
      outcome: 'held',
      copy_intent_id: 'intent-1',
      intent_status: 'awaiting_confirmation',
      intent_payload: {
        connectionId: 'connection-1',
        accountId: 'account-1',
        instrumentId: 'BTCUSDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        quantity: '0.01',
        idempotencyKey: 'copy-submit-key',
      },
    };
    let submittedOrder;
    const queries = {
      async findPublishedSignalById() {
        return { id: 'signal-1', provider_id: 'provider-1', status: 'published' };
      },
      async findCopyConfigurationById() {
        return {
          id: 'config-1',
          workspace_id: 'workspace-1',
          created_by: 'subscriber-1',
          provider_id: 'provider-1',
          status: 'active',
        };
      },
      async listCopyRecordsForSignalConfiguration() { return [record]; },
      async findCopyRecordForConfirmation() { return record; },
      async claimCopyExecutionIntent(_intentId, expectedStatus) {
        if (record.intent_status !== expectedStatus) return null;
        record.intent_status = 'confirming';
        return { intent_payload: record.intent_payload, status: 'confirming' };
      },
      async updateCopyExecutionIntent(_intentId, { status }) {
        record.intent_status = status;
      },
      async updateCopyProcessingRecord(_id, changes) {
        Object.assign(record, changes);
      },
      async updateCopyDestinationResult() {},
    };
    const service = createCopyOrchestrationService({
      db: { async tx(callback) { return callback({}); } },
      queries,
      subscriptionService: {
        async getSubscription({ userId, providerId }) {
          assert.equal(userId, 'subscriber-1');
          assert.equal(providerId, 'provider-1');
          return { status: 'active' };
        },
      },
      terminal: {
        async submitOrder(order) {
          submittedOrder = order;
          return { order: { id: 'exchange-order-1', status: 'submitted' } };
        },
      },
      events: {},
    });

    const result = await service.copySignalNow({
      userId: 'subscriber-1',
      workspaceId: 'workspace-1',
      signalId: 'signal-1',
      configId: 'config-1',
    });

    assert.deepEqual(result, { results: [{ status: 'submitted', orderId: 'exchange-order-1' }] });
    assert.equal(submittedOrder.connectionId, 'connection-1');
    assert.equal(submittedOrder.accountId, 'account-1');
    assert.equal(submittedOrder.idempotencyKey, 'copy-submit-key');
  });

  it('routes a manual quote-sized copy to eligible selected accounts and skips an underfunded destination', async () => {
    const records = new Map();
    const intents = new Map();
    const submitted = [];
    let recordSequence = 0;
    let intentSequence = 0;
    const signal = {
      id: 'signal-copy',
      provider_id: 'provider-1',
      status: 'published',
      instrument: 'BTCUSDT',
      market_type: 'futures',
      direction: 'long',
      order_type: 'market',
      stop_loss: '90',
      targets: ['110'],
    };
    const destinations = [
      {
        id: 'destination-low',
        account_id: 'account-low',
        connection_id: 'connection-low',
        exchange_code: 'bybit',
        connection_status: 'active',
        account_status: 'active',
        account_type: 'unified',
        environment: 'testnet',
      },
      {
        id: 'destination-funded',
        account_id: 'account-funded',
        connection_id: 'connection-funded',
        exchange_code: 'binance',
        connection_status: 'active',
        account_status: 'active',
        account_type: 'unified',
        environment: 'testnet',
      },
      {
        id: 'destination-uncertain',
        account_id: 'account-uncertain',
        connection_id: 'connection-uncertain',
        exchange_code: 'okx',
        connection_status: 'active',
        account_status: 'active',
        account_type: 'unified',
        environment: 'testnet',
      },
    ];
    const service = createCopyOrchestrationService({
      db: { async tx(callback) { return callback({}); } },
      queries: {
        async findPublishedSignalById() { return signal; },
        async findCopyConfigurationById() {
          return {
            id: 'config-1',
            workspace_id: 'workspace-1',
            created_by: 'subscriber-1',
            provider_id: 'provider-1',
            status: 'active',
            current_version: 1,
            execution_mode: 'confirm_before_execution',
            market_types: ['futures'],
          };
        },
        async listCopyDestinations() { return destinations; },
        async cancelPendingCopyIntentsForSignal() { return 0; },
        async insertCopyProcessingRecord(_tx, data) {
          const record = {
            id: `record-${++recordSequence}`,
            ...data,
            subscriber_user_id: data.subscriberUserId,
          };
          records.set(record.id, record);
          return record;
        },
        async insertCopyDestinationResult() {},
        async insertCopyExecutionIntent(_tx, data) {
          const intent = {
            id: `intent-${++intentSequence}`,
            intent_payload: data.payload,
            status: 'awaiting_confirmation',
          };
          intents.set(intent.id, intent);
          return intent;
        },
        async updateCopyProcessingRecord(id, changes) {
          Object.assign(records.get(id), changes);
        },
        async findCopyRecordForConfirmation(recordId) {
          const record = records.get(recordId);
          const intent = intents.get(record.executionIntentId);
          return {
            ...record,
            workspace_id: 'workspace-1',
            copy_intent_id: intent.id,
            intent_payload: intent.intent_payload,
            intent_status: intent.status,
          };
        },
        async claimCopyExecutionIntent(intentId) {
          const intent = intents.get(intentId);
          intent.status = 'confirming';
          return intent;
        },
        async updateCopyExecutionIntent(intentId, { status }) {
          intents.get(intentId).status = status;
        },
        async updateCopyDestinationResult() {},
      },
      subscriptionService: {
        async getSubscription() { return { status: 'active' }; },
      },
      connections: {
        async getAdapter() {
          return {
            capabilities: {
              hasFutures: true,
              hasAttachedBracketProtectionMarkets: ['futures'],
              hasAttachedBracketProtectionOrderTypes: { futures: ['market'] },
            },
            async fetchAccountState({ connectionId }) {
              const free = connectionId === 'connection-low' ? '50' : '1000';
              return { status: 'healthy', balances: [{ asset: 'USDT', free }] };
            },
          };
        },
        async getInstrument() {
          return {
            trading_status: 'active',
            market_type: 'futures',
            base_asset: 'BTC',
            quote_asset: 'USDT',
          };
        },
        async loadCredentials(connectionId) { return { connectionId }; },
      },
      risk: {
        evaluation: {
          async evaluate() { return { outcome: 'allowed', id: 'risk-1' }; },
        },
      },
      terminal: {
        async submitOrder(order) {
          submitted.push(order);
          if (order.accountId === 'account-uncertain') {
            throw new Error('Exchange response timed out after submission');
          }
          return { order: { id: 'copy-order-funded', status: 'submitted' } };
        },
      },
      marketData: { async getMarketData() { return { overview: { lastPrice: 100 } }; } },
      events: { async publish() {} },
      logger: { warn() {}, error() {}, info() {} },
    });

    const result = await service.copySignalNow({
      userId: 'subscriber-1',
      workspaceId: 'workspace-1',
      signalId: signal.id,
      configId: 'config-1',
      destinationAccountIds: ['account-low', 'account-funded', 'account-uncertain'],
      amount: '200',
    });

    assert.equal(result.results.length, 3);
    assert.equal(result.results[0].status, 'skipped');
    assert.match(result.results[0].errorMessage, /Insufficient USDT balance/);
    assert.equal(result.results[1].status, 'submitted');
    assert.equal(result.results[2].status, 'reconciliation_required');
    assert.match(result.results[2].errorMessage, /timed out after submission/);
    assert.equal(submitted.length, 2);
    assert.equal(submitted[0].accountId, 'account-funded');
    assert.equal(submitted[1].accountId, 'account-uncertain');
    assert.equal(submitted[0].quantity, '2');
    assert.equal(submitted[0].stopLoss, '90');
    assert.equal(submitted[0].takeProfit, '110');
    assert.equal(recordSequence, 3);
  });

  it('returns and persists the exchange rejection reason for copied signals', async () => {
    const record = {
      id: 'record-rejected',
      subscriber_user_id: 'subscriber-1',
      outcome: 'held',
      copy_intent_id: 'intent-rejected',
      intent_status: 'awaiting_confirmation',
      intent_payload: {
        connectionId: 'connection-1',
        accountId: 'account-1',
        instrumentId: 'BTCUSDT',
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        quantity: '0.01',
        idempotencyKey: 'copy-submit-key',
      },
    };
    let destinationResult;
    const queries = {
      async findPublishedSignalById() {
        return { id: 'signal-1', provider_id: 'provider-1', status: 'published' };
      },
      async findCopyConfigurationById() {
        return {
          id: 'config-1',
          workspace_id: 'workspace-1',
          created_by: 'subscriber-1',
          provider_id: 'provider-1',
          status: 'active',
        };
      },
      async listCopyRecordsForSignalConfiguration() { return [record]; },
      async findCopyRecordForConfirmation() { return record; },
      async claimCopyExecutionIntent() {
        return { intent_payload: record.intent_payload, status: 'confirming' };
      },
      async updateCopyExecutionIntent() {},
      async updateCopyProcessingRecord() {},
      async updateCopyDestinationResult(_id, result) {
        destinationResult = result;
      },
    };
    const service = createCopyOrchestrationService({
      db: { async tx(callback) { return callback({}); } },
      queries,
      subscriptionService: {
        async getSubscription() { return { status: 'active' }; },
      },
      terminal: {
        async submitOrder() {
          return {
            order: {
              id: 'order-rejected',
              status: 'rejected',
              rejection_reason: 'Order quantity has too many decimals.',
            },
          };
        },
      },
    });

    const result = await service.copySignalNow({
      userId: 'subscriber-1',
      workspaceId: 'workspace-1',
      signalId: 'signal-1',
      configId: 'config-1',
    });

    assert.deepEqual(result, {
      results: [{
        status: 'rejected',
        orderId: 'order-rejected',
        errorMessage: 'Order quantity has too many decimals.',
      }],
    });
    assert.equal(destinationResult.skipReason, 'execution_rejected');
    assert.equal(destinationResult.errorMessage, 'Order quantity has too many decimals.');
    assert.equal(destinationResult.destinationOrderId, 'order-rejected');
  });

  it('does not submit through another user’s copy configuration', async () => {
    let subscriptionLookup = false;
    const service = createCopyOrchestrationService({
      db: {},
      queries: {
        async findPublishedSignalById() {
          return { id: 'signal-1', provider_id: 'provider-1', status: 'published' };
        },
        async findCopyConfigurationById() {
          return {
            id: 'config-1',
            workspace_id: 'workspace-1',
            created_by: 'another-user',
            provider_id: 'provider-1',
            status: 'active',
          };
        },
      },
      subscriptionService: {
        async getSubscription() { subscriptionLookup = true; return { status: 'active' }; },
      },
    });

    await assert.rejects(
      service.copySignalNow({
        userId: 'subscriber-1',
        workspaceId: 'workspace-1',
        signalId: 'signal-1',
        configId: 'config-1',
      }),
      { code: 'NOT_FOUND' },
    );
    assert.equal(subscriptionLookup, false);
  });

  it('activates paid marketplace subscriptions only after a successful Stripe invoice webhook', async () => {
    const transaction = {};
    const updates = [];
    let seenEvent = false;
    const queries = {
      async insertMarketplaceStripeWebhookEvent(client, { eventId, eventType }) {
        assert.equal(client, transaction);
        assert.equal(eventId, 'evt_paid');
        assert.equal(eventType, 'invoice.paid');
        if (seenEvent) return null;
        seenEvent = true;
        return { event_id: eventId };
      },
      async findSubscriptionByStripeId(id, client) {
        assert.equal(client, transaction);
        assert.equal(id, 'sub_marketplace');
        return { id: 'subscription-1' };
      },
      async findSubscriptionById(id, client) {
        assert.equal(client, transaction);
        return { id, status: 'subscription_pending' };
      },
      async updateMarketplaceSubscription(id, fields, client) {
        assert.equal(client, transaction);
        updates.push({ id, fields });
        return { id, ...fields };
      },
      async insertSubscriptionEvent(client, event) {
        assert.equal(client, transaction);
        assert.equal(event.subscriptionId, 'subscription-1');
      },
    };
    const service = createStripeMarketplaceService({
      db: { async tx(callback) { return callback(transaction); } },
      queries,
      config: {},
      providerService: {},
    });

    const event = {
      id: 'evt_paid',
      type: 'invoice.paid',
      data: {
        object: {
          subscription: 'sub_marketplace',
          lines: { data: [{ period: { start: 1770000000, end: 1772600000 } }] },
        },
      },
    };
    assert.deepEqual(await service.handleWebhook({ event }), { handled: true });
    assert.equal(updates[0].id, 'subscription-1');
    assert.equal(updates[0].fields.status, 'active');
    assert.equal(updates[0].fields.currentPeriodStart.getTime(), 1770000000 * 1000);
    assert.deepEqual(await service.handleWebhook({ event }), { handled: true, duplicate: true });
    assert.equal(updates.length, 1);
  });

  it('creates recurring Stripe checkout with the configured Connect transfer and platform fee', async () => {
    const transaction = {};
    let checkoutPayload;
    const persisted = [];
    const stripeClient = {
      accounts: {
        async retrieve(accountId) {
          assert.equal(accountId, 'acct_trader');
          return {
            id: accountId,
            details_submitted: true,
            capabilities: { transfers: { status: 'active' } },
            payouts_enabled: true,
          };
        },
      },
      checkout: {
        sessions: {
          async create(payload, options) {
            checkoutPayload = payload;
            assert.equal(options.idempotencyKey, 'marketplace-checkout:subscription-1');
            return { id: 'cs_marketplace', url: 'https://stripe.test/checkout' };
          },
        },
      },
    };
    const queries = {
      async findProviderById() {
        return {
          id: 'provider-1',
          stripe_connect_account_id: 'acct_trader',
          stripe_country: 'US',
          stripe_details_submitted: true,
          stripe_transfers_enabled: true,
          stripe_payouts_enabled: true,
        };
      },
      async updateProviderStripeAccount(providerId, fields) {
        assert.equal(providerId, 'provider-1');
        return {
          id: providerId,
          stripe_connect_account_id: 'acct_trader',
          stripe_details_submitted: fields.detailsSubmitted,
          stripe_transfers_enabled: fields.transfersEnabled,
          stripe_payouts_enabled: fields.payoutsEnabled,
        };
      },
      async findPendingSubscription() { return null; },
      async insertSubscription(client, data) {
        assert.equal(client, transaction);
        assert.equal(data.subscriberUserId, 'subscriber-1');
        return { id: 'subscription-1' };
      },
      async insertSubscriptionEvent(client, event) {
        assert.equal(client, transaction);
        assert.equal(event.eventType, 'checkout_started');
      },
      async updateMarketplaceSubscription(subscriptionId, fields) {
        persisted.push({ subscriptionId, fields });
      },
    };
    const service = createStripeMarketplaceService({
      db: {
        async tx(callback) { return callback(transaction); },
        async query() { return { rows: [{ email: 'subscriber@example.test' }] }; },
      },
      queries,
      providerService: {},
      config: {
        app: { url: 'https://syncexc.test' },
        marketplace: { platformFeePercent: 2 },
        payments: {
          stripe: { enabled: true, secretKey: 'test_secret', webhookSecret: 'test_webhook' },
        },
      },
      stripeClient,
    });

    const result = await service.createSubscriptionCheckout({
      userId: 'subscriber-1',
      provider: { id: 'provider-1', display_name: 'Trader One' },
      plan: {
        id: 'plan-1',
        name: 'Monthly',
        pricing: { amountMinor: 1500, currency: 'USD', billingInterval: 'monthly' },
      },
      workspaceId: 'workspace-1',
    });

    assert.deepEqual(result, {
      subscriptionId: 'subscription-1',
      redirectUrl: 'https://stripe.test/checkout',
    });
    assert.equal(checkoutPayload.mode, 'subscription');
    assert.equal(checkoutPayload.line_items[0].price_data.recurring.interval, 'month');
    assert.equal(checkoutPayload.subscription_data.transfer_data.destination, 'acct_trader');
    assert.equal(checkoutPayload.subscription_data.application_fee_percent, 2);
    assert.equal(checkoutPayload.customer_email, 'subscriber@example.test');
    assert.equal(persisted[0].fields.checkoutSessionId, 'cs_marketplace');
  });

  it('logs safe Stripe diagnostics and request correlation when Connect account creation fails', async () => {
    let logged;
    const stripeFailure = Object.assign(new Error('Sensitive provider response'), {
      name: 'StripeInvalidRequestError',
      type: 'StripeInvalidRequestError',
      statusCode: 400,
      requestId: 'req_stripe_123',
      param: 'requested_capabilities',
    });
    const service = createStripeMarketplaceService({
      db: {},
      queries: {},
      providerService: {
        async getManagedProvider() {
          return { id: 'provider-1', stripe_connect_account_id: null };
        },
      },
      config: {
        payments: { stripe: { enabled: true, secretKey: 'test_secret' } },
      },
      logger: {
        error(metadata, message) {
          logged = { metadata, message };
        },
      },
      stripeClient: {
        accounts: {
          async create() {
            throw stripeFailure;
          },
        },
      },
    });

    await assert.rejects(
      service.startPayoutOnboarding({
        userId: 'trader-1',
        workspaceId: 'workspace-1',
        country: 'US',
        requestId: 'request-123',
      }),
      { code: 'STRIPE_CAPABILITY_UNAVAILABLE', status: 409 },
    );
    assert.equal(logged.message, 'Stripe Connect account creation failed');
    assert.deepEqual(logged.metadata, {
      errorName: 'StripeInvalidRequestError',
      stripeErrorType: 'StripeInvalidRequestError',
      stripeStatusCode: 400,
      stripeRequestId: 'req_stripe_123',
      stripeParameter: 'requested_capabilities',
      providerId: 'provider-1',
      requestId: 'request-123',
      country: 'US',
    });
    assert.equal(JSON.stringify(logged).includes('Sensitive provider response'), false);
  });

  it('accepts a complete limit signal with an explicit entry price', () => {
    const { value, error } = PublishSignalRequestSchema.validate({
      instrument: 'BTCUSDT',
      marketType: 'spot',
      direction: 'long',
      orderType: 'limit',
      entry: '60000',
      stopLoss: '58000',
      targets: ['62000'],
      executionAccountIds: ['550e8400-e29b-41d4-a716-446655440000'],
      executionAmount: '100',
    });

    assert.equal(error, undefined);
    assert.equal(value.orderType, 'limit');
    assert.equal(value.entry, '60000');
  });

  it('defaults signal order type to market without requiring an entry price', () => {
    const { value, error } = PublishSignalRequestSchema.validate({
      instrument: 'BTCUSDT',
      marketType: 'spot',
      direction: 'long',
      stopLoss: '58000',
      targets: ['62000'],
      executionAccountIds: ['550e8400-e29b-41d4-a716-446655440000'],
      executionAmount: '100',
    });

    assert.equal(error, undefined);
    assert.equal(value.orderType, 'market');
    assert.equal(value.entry, undefined);
  });

  it('requires entry price for limit signals and disallows it for market signals', () => {
    const missingLimitEntry = PublishSignalRequestSchema.validate({
      instrument: 'BTCUSDT',
      marketType: 'spot',
      direction: 'long',
      orderType: 'limit',
      stopLoss: '58000',
      targets: ['62000'],
    });
    assert.equal(missingLimitEntry.error?.details[0]?.path[0], 'entry');

    const marketWithEntry = PublishSignalRequestSchema.validate({
      instrument: 'BTCUSDT',
      marketType: 'spot',
      direction: 'long',
      entry: '60000',
      stopLoss: '58000',
      targets: ['62000'],
    });
    assert.equal(marketWithEntry.error?.details[0]?.path[0], 'entry');
  });

  it('requires positive stop loss and at least one take-profit target', () => {
    const { error } = PublishSignalRequestSchema.validate({
      instrument: 'BTCUSDT',
      marketType: 'spot',
      direction: 'long',
    }, { abortEarly: false });
    const paths = error.details.map((detail) => detail.path[0]);
    assert.ok(paths.includes('stopLoss'));
    assert.ok(paths.includes('targets'));
  });

  it('serializes full execution details and copy count', () => {
    const signal = serializePublishedSignal({
      id: 'signal-1',
      provider_id: 'provider-1',
      instrument: 'BTCUSDT',
      market_type: 'spot',
      direction: 'long',
      order_type: 'limit',
      entry_time: new Date('2026-03-01T12:30:00.000Z'),
      entry: '60000',
      entry_range: null,
      stop_loss: '58000',
      targets: ['62000', '64000'],
      copy_count: '3',
      created_at: new Date('2026-03-01T12:00:00.000Z'),
    });

    assert.equal(signal.orderType, 'limit');
    assert.equal(signal.entryTime.toISOString(), '2026-03-01T12:30:00.000Z');
    assert.deepEqual(signal.targets, ['62000', '64000']);
    assert.equal(signal.copyCount, 3);
  });

  it('serializes trader-only execution diagnostics without adding them to public signals', () => {
    const signal = serializePublishedSignal({
      id: 'signal-1',
      trader_executions: [{
        status: 'skipped_not_configured',
        errorMessage: 'Set a trader signal execution percentage in trading preferences.',
      }],
    });
    const publicSignal = serializePublishedSignal({ id: 'public-signal-1' });

    assert.deepEqual(signal.traderExecutions, [{
      status: 'skipped_not_configured',
      errorMessage: 'Set a trader signal execution percentage in trading preferences.',
    }]);
    assert.equal(Object.hasOwn(publicSignal, 'traderExecutions'), false);
  });

  it('counts only successful subscriber copies and loads private execution diagnostics on request', async () => {
    let executedOnlyQuery;
    let privateQuery;
    const queries = createMarketplaceQueries({
      db: {
        async query(query) {
          if (query.includes('trader_executions')) privateQuery = query;
          else executedOnlyQuery = query;
          return { rows: [] };
        },
      },
    });

    await queries.listPublishedSignals({ providerId: 'provider-1', publicOnly: true });
    await queries.listPublishedSignals({
      providerId: 'provider-1',
      includeTraderExecution: true,
    });

    assert.match(executedOnlyQuery, /processing\.outcome = 'executed'/);
    assert.match(executedOnlyQuery, /processing\.subscriber_user_id <> provider\.user_id/);
    assert.doesNotMatch(executedOnlyQuery, /trader_executions/);
    assert.match(privateQuery, /marketplace_trader_signal_executions/);
    assert.match(privateQuery, /AS trader_executions/);
  });

  it('creates new Trader profiles as approved', async () => {
    let insertQuery;
    const client = {
      async query(query) {
        insertQuery = query;
        return { rows: [{ id: 'provider-1', moderation_state: 'approved' }] };
      },
    };
    const queries = createMarketplaceQueries({ db: {} });

    const provider = await queries.insertProvider(client, {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      handle: 'trader',
      displayName: 'Trader',
      accountType: 'individual',
    });

    assert.match(insertQuery, /moderation_state/);
    assert.match(insertQuery, /'approved'/);
    assert.equal(provider.moderation_state, 'approved');
  });

  it('lists only the signals owned by the active Trader workspace', async () => {
    let providerLookup;
    let signalLookup;
    const controller = createMarketplaceController({
      providerService: {
        async getProviderForUser(userId, workspaceId) {
          providerLookup = { userId, workspaceId };
          return { id: 'provider-1' };
        },
      },
      publicationService: {
        async listSignals(query) {
          signalLookup = query;
          return {
            rows: [{
              id: 'signal-1',
              provider_id: 'provider-1',
              instrument: 'BTCUSDT',
              market_type: 'spot',
              direction: 'long',
              entry: '60000',
              status: 'published',
              created_at: new Date('2026-01-01T00:00:00.000Z'),
              metadata: { sourceEvidence: 'https://example.test/evidence' },
            }],
            nextCursor: null,
          };
        },
      },
    });
    const response = createResponse();

    await controller.listMySignals({
      auth: { userId: 'user-1' },
      workspace: { id: 'workspace-1' },
      query: { limit: '25', status: 'published' },
    }, response);

    assert.deepEqual(providerLookup, { userId: 'user-1', workspaceId: 'workspace-1' });
    assert.deepEqual(signalLookup, {
      providerId: 'provider-1',
      status: 'published',
      includeTraderExecution: true,
      limit: 25,
      cursor: null,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data[0].id, 'signal-1');
    assert.equal(response.body.data[0].marketType, 'spot');
    assert.equal(response.body.data[0].sourceEvidence, 'https://example.test/evidence');
  });

  it('requires an active subscription before returning provider signals', async () => {
    let queriedSignals = false;
    const controller = createMarketplaceController({
      providerService: {
        async getProvider() {
          return {
            id: 'provider-1',
            visibility: 'public',
            moderation_state: 'approved',
          };
        },
      },
      subscriptionService: {
        async getSubscription() {
          return null;
        },
      },
      publicationService: {
        async listSignals() {
          queriedSignals = true;
          return { rows: [], nextCursor: null };
        },
      },
    });

    await assert.rejects(
      controller.listSignals({
        params: { providerId: 'provider-1' },
        auth: { userId: 'user-1' },
        query: {},
      }, createResponse()),
      { code: 'SUBSCRIPTION_REQUIRED' },
    );
    assert.equal(queriedSignals, false);
  });

  it('returns only published signals to an active provider subscriber', async () => {
    let signalQuery;
    const controller = createMarketplaceController({
      providerService: {
        async getProvider() {
          return {
            id: 'provider-1',
            visibility: 'public',
            moderation_state: 'approved',
          };
        },
      },
      subscriptionService: {
        async getSubscription() {
          return { status: 'active' };
        },
      },
      publicationService: {
        async listSignals(query) {
          signalQuery = query;
          return { rows: [], nextCursor: null };
        },
      },
    });
    const response = createResponse();

    await controller.listSignals({
      params: { providerId: 'provider-1' },
      auth: { userId: 'user-1' },
      query: { status: 'draft' },
    }, response);

    assert.deepEqual(signalQuery, {
      providerId: 'provider-1',
      publicOnly: true,
      limit: 50,
      cursor: null,
    });
    assert.equal(response.statusCode, 200);
  });

  it('filters public signal queries to published and updated statuses', async () => {
    let sql;
    const queries = createMarketplaceQueries({
      db: {
        async query(query) {
          sql = query;
          return { rows: [] };
        },
      },
    });

    await queries.listPublishedSignals({ providerId: 'provider-1', publicOnly: true });

    assert.match(sql, /signal\.status IN \('published', 'updated'\)/);
    assert.match(sql, /count\(DISTINCT processing\.subscriber_user_id\)/);
    assert.doesNotMatch(sql, /draft|cancelled|rejected/);
  });

  it('includes subscriber and active signal counts in marketplace provider listings', async () => {
    const statements = [];
    const queries = createMarketplaceQueries({
      db: {
        async query(query) {
          statements.push(query);
          if (query.includes('FROM schema_migrations')) {
            return { rows: [{ applied: false }] };
          }
          return { rows: [{ id: 'provider-1', created_at: new Date() }] };
        },
      },
    });

    await queries.listProviders();

    assert.match(statements[0], /AS subscriber_count/);
    assert.match(statements[0], /AS signal_count\s+FROM/);
    assert.doesNotMatch(statements[0], /marketplace_signal_closed_trades/);
    assert.match(statements[0], /subscription\.status IN \('active', 'trialing'\)/);
    assert.match(statements[1], /schema_migrations/);
    assert.equal(statements.length, 2);
  });

  it('loads marketplace PnL after the signal-execution migration is applied', async () => {
    const provider = { id: 'provider-1', created_at: new Date() };
    const queries = createMarketplaceQueries({
      db: {
        async query(query) {
          if (query.includes('FROM marketplace_provider_profiles provider')) {
            return { rows: [provider] };
          }
          if (query.includes('FROM schema_migrations')) {
            return { rows: [{ applied: true }] };
          }
          assert.match(query, /marketplace_signal_closed_trades/);
          return {
            rows: [{
              provider_id: 'provider-1',
              pnl_asset: 'USDT',
              net_pnl: '12.5',
              observed_executions: 2,
              wins: 1,
            }],
          };
        },
      },
    });

    const result = await queries.listProviders();

    assert.deepEqual(result.rows[0].realized_pnl_by_asset, [{
      asset: 'USDT',
      netPnl: '12.5',
      observedExecutions: 2,
      wins: 1,
    }]);
  });

  it('publishes an opted-in terminal fill once as a limit signal', async () => {
    const handlers = new Map();
    let publishedSignal;
    createMarketplaceListeners({
      events: {
        subscribe(topic, handler) {
          handlers.set(topic, handler);
        },
      },
      copyOrchestration: { async processPublishedSignal() {} },
      traderSignalExecution: {
        async executePublishedSignal() {},
        async handleOrderFilled() {},
        async handleOrderStatus() {},
        async handleClosedTrade() {},
      },
      publicationService: {
        async publishSignal(signal) {
          publishedSignal = signal;
        },
      },
      queries: {
        async findPublishedSignalBySourceOrderId() {
          return null;
        },
        async findOrderForAutoPublication(orderId) {
          assert.equal(orderId, 'order-1');
          return {
            id: orderId,
            workspace_id: 'workspace-1',
            provider_id: 'provider-1',
            user_id: 'user-1',
            instrument: 'BTCUSDT',
            market_type: 'spot',
            side: 'buy',
            type: 'limit',
            average_fill_price: '60000',
            created_at: new Date('2026-03-01T12:30:00.000Z'),
          };
        },
      },
      logger: { debug() {}, error() {} },
    });

    await handlers.get('execution.order_filled')({ payload: { orderId: 'order-1' } });

    assert.equal(publishedSignal.orderType, 'limit');
    assert.equal(publishedSignal.entry, '60000');
    assert.equal(publishedSignal.direction, 'long');
    assert.equal(publishedSignal.sourceOrderId, 'order-1');
  });

  it('requires signal access before returning comments', async () => {
    const discussion = createSignalDiscussionService({
      queries: {
        async canAccessSignalDiscussion() { return false; },
        async listSignalComments() { throw new Error('must not query comments'); },
      },
    });

    await assert.rejects(
      discussion.list({ signalId: 'signal-1', userId: 'user-1' }),
      { code: 'NOT_FOUND' },
    );
  });

  it('stores only image proofs with valid file signatures', async () => {
    let saved;
    const discussion = createSignalDiscussionService({
      queries: {
        async canAccessSignalDiscussion() { return true; },
        async insertSignalComment(comment) {
          saved = comment;
          return { id: 'comment-1' };
        },
      },
    });

    await discussion.create({
      signalId: 'signal-1',
      userId: 'user-1',
      content: 'Closed green',
      file: {
        mimetype: 'image/png',
        originalname: '..\\proof.png',
        buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      },
    });
    assert.equal(saved.proofMimeType, 'image/png');
    assert.equal(saved.proofName, 'proof.png');
    await assert.rejects(
      discussion.create({
        signalId: 'signal-1',
        userId: 'user-1',
        content: '',
        file: { mimetype: 'image/png', buffer: Buffer.from('not png') },
      }),
      { code: 'VALIDATION_ERROR' },
    );
  });

  it('does not allow copy configuration without an active subscription', async () => {
    const service = createCopyConfigurationService({
      db: {},
      queries: {
        async findProviderById() {
          return {
            id: 'provider-1',
            moderation_state: 'approved',
            visibility: 'public',
          };
        },
        async findActiveSubscription() {
          return null;
        },
      },
    });

    await assert.rejects(
      service.createConfiguration({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        providerId: 'provider-1',
      }),
      { code: 'SUBSCRIPTION_REQUIRED' },
    );
  });

  it('returns an empty list when the active workspace has no Trader profile', async () => {
    let queriedSignals = false;
    const controller = createMarketplaceController({
      providerService: { async getProviderForUser() { return null; } },
      publicationService: {
        async listSignals() {
          queriedSignals = true;
          return { rows: [], nextCursor: null };
        },
      },
    });
    const response = createResponse();

    await controller.listMySignals({
      auth: { userId: 'user-1' },
      workspace: { id: 'workspace-1' },
      query: {},
    }, response);

    assert.equal(queriedSignals, false);
    assert.deepEqual(response.body.data, []);
  });

  it('returns an empty dashboard when the active workspace has no Trader profile', async () => {
    const service = createProviderService({
      queries: {
        async findProviderByWorkspaceId() { return null; },
      },
    });

    const dashboard = await service.getProviderDashboard({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    assert.equal(dashboard, null);
  });

  it('keeps subscriber and plan management scoped to Trader workspace managers', async () => {
    const service = createProviderService({
      db: {
        async query() {
          return { rows: [{ type: 'trader', role: 'member' }] };
        },
      },
      queries: {
        async findProviderByWorkspaceId() {
          return { id: 'provider-1', workspace_id: 'workspace-1' };
        },
      },
    });

    await assert.rejects(
      service.listProviderSubscribers({ userId: 'member-1', workspaceId: 'workspace-1' }),
      { code: 'FORBIDDEN' },
    );
    await assert.rejects(
      service.listManagedProviderPlans({ userId: 'member-1', workspaceId: 'workspace-1' }),
      { code: 'FORBIDDEN' },
    );
  });

  it('includes editable methodology and published signal metadata in client serializers', () => {
    assert.equal(serializeProvider({
      id: 'provider-1',
      methodology: 'Risk-managed trend following',
      supported_markets: ['spot'],
    }).methodology, 'Risk-managed trend following');

    const signal = serializePublishedSignal({
      id: 'signal-1',
      provider_id: 'provider-1',
      instrument: 'BTCUSDT',
      market_type: 'spot',
      direction: 'long',
      entry_range: { min: 1, max: 2 },
      targets: ['3'],
      metadata: { disclosures: 'Risk applies' },
    });
    assert.deepEqual(signal.entryRange, { min: 1, max: 2 });
    assert.deepEqual(signal.targets, ['3']);
    assert.equal(signal.disclosures, 'Risk applies');
  });

  it('executes the private trader plan before publishing the signal event', async () => {
    const transactions = [];
    let updateClient;
    const order = [];
    const service = createPublicationService({
      db: {
        async tx(callback) {
          const transaction = { index: transactions.length };
          transactions.push(transaction);
          return callback(transaction);
        },
      },
      queries: {
        async findProviderById() {
          return {
            id: 'provider-1',
            user_id: 'user-1',
            workspace_id: 'workspace-1',
            moderation_state: 'approved',
          };
        },
        async insertPublishedSignal(client) {
          assert.equal(client, transactions[0]);
          return { id: 'signal-1', provider_id: 'provider-1', status: 'draft' };
        },
        async insertPublishedSignalVersion(client) {
          assert.equal(client, transactions[0]);
        },
        async insertPublication(client) {
          assert.equal(client, transactions[0]);
        },
        async updatePublishedSignal(_signalId, changes, bumpVersion, client) {
          order.push('published');
          updateClient = client;
          assert.deepEqual(changes, { status: 'published' });
          assert.equal(bumpVersion, false);
          return { id: 'signal-1', provider_id: 'provider-1', status: 'published' };
        },
      },
      events: { async publish() { order.push('event'); } },
    });

    const publishedSignal = await service.publishSignal({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      providerId: 'provider-1',
      instrument: 'BTCUSDT',
      marketType: 'spot',
      direction: 'long',
      entry: '60000',
      orderType: 'limit',
      stopLoss: '58000',
      targets: ['62000'],
      executionAccountIds: ['account-1'],
      executionAmount: '250',
      beforePublish: async ({ signal, accountIds, amount }) => {
        assert.equal(signal.status, 'draft');
        assert.deepEqual(accountIds, ['account-1']);
        assert.equal(amount, '250');
        order.push('trader-execution');
      },
    });

    assert.deepEqual(order, ['trader-execution', 'published', 'event']);
    assert.equal(updateClient, transactions[1]);
    assert.equal(publishedSignal.status, 'published');
  });

  it('requires stop loss, take profit, and limit entry before manual publication', async () => {
    const service = createPublicationService({
      db: { async tx() { throw new Error('Invalid signal must not start a transaction'); } },
      queries: {
        async findProviderById() {
          return {
            id: 'provider-1',
            user_id: 'user-1',
            workspace_id: 'workspace-1',
            moderation_state: 'approved',
          };
        },
      },
      events: {},
    });

    await assert.rejects(
      service.publishSignal({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        providerId: 'provider-1',
        instrument: 'BTCUSDT',
        marketType: 'spot',
        direction: 'long',
        orderType: 'limit',
        stopLoss: '58000',
        targets: ['62000'],
      }),
      /Limit orders require a positive entry price/,
    );

    await assert.rejects(
      service.publishSignal({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        providerId: 'provider-1',
        instrument: 'BTCUSDT',
        marketType: 'spot',
        direction: 'long',
        orderType: 'market',
      }),
      /A positive stop loss is required/,
    );
  });

  it('saves the Trader profile and version snapshot in one transaction', async () => {
    const transaction = {};
    let updateClient;
    let versionClient;
    const service = createProviderService({
      db: {
        async tx(callback) {
          return callback(transaction);
        },
      },
      queries: {
        async findProviderById() {
          return {
            id: 'provider-1',
            user_id: 'user-1',
            workspace_id: 'workspace-1',
            moderation_state: 'approved',
            current_version: 1,
          };
        },
        async updateProvider(_providerId, _updates, client) {
          updateClient = client;
          return { id: 'provider-1', current_version: 2 };
        },
        async insertProviderProfileVersion(client) {
          versionClient = client;
        },
      },
    });

    await service.updateProvider({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      providerId: 'provider-1',
      updates: { displayName: 'Example Trader' },
    });

    assert.equal(updateClient, transaction);
    assert.equal(versionClient, transaction);
  });

  it('creates subscription plans in draft status and versions the plan transactionally', async () => {
    const transaction = {};
    let planVersionClient;
    const service = createProviderService({
      db: {
        async query() {
          return { rows: [{ type: 'trader', role: 'owner' }] };
        },
        async tx(callback) {
          return callback(transaction);
        },
      },
      queries: {
        async findProviderByWorkspaceId() {
          return { id: 'provider-1', workspace_id: 'workspace-1' };
        },
        async insertProviderPlan(client, plan) {
          assert.equal(client, transaction);
          assert.equal(plan.providerId, 'provider-1');
          return {
            id: 'plan-1',
            provider_id: 'provider-1',
            status: 'draft',
            version: 1,
            pricing: plan.pricing,
          };
        },
        async insertProviderPlanVersion(client) {
          planVersionClient = client;
        },
      },
    });

    const plan = await service.createProviderPlan({
      userId: 'owner-1',
      workspaceId: 'workspace-1',
      name: 'Free signals',
      pricing: { currency: 'USD', amountMinor: 0, billingInterval: 'monthly' },
      entitlements: { features: ['Signal updates'] },
    });

    assert.equal(plan.status, 'draft');
    assert.equal(planVersionClient, transaction);
  });

  it('does not activate paid plans when Stripe billing is not configured', async () => {
    let transactionStarted = false;
    const service = createProviderService({
      db: {
        async query() {
          return { rows: [{ type: 'trader', role: 'owner' }] };
        },
        async tx(callback) {
          transactionStarted = true;
          return callback({});
        },
      },
      queries: {
        async findProviderByWorkspaceId() {
          return {
            id: 'provider-1',
            moderation_state: 'approved',
            visibility: 'public',
          };
        },
        async findProviderPlanById() {
          return {
            id: 'plan-1',
            provider_id: 'provider-1',
            status: 'draft',
            pricing: { amountMinor: 999 },
          };
        },
      },
    });

    await assert.rejects(
      service.updateProviderPlan({
        userId: 'owner-1',
        workspaceId: 'workspace-1',
        planId: 'plan-1',
        status: 'active',
      }),
      { code: 'STRIPE_NOT_CONFIGURED' },
    );
    assert.equal(transactionStarted, false);
  });

  it('does not start a subscription for a non-public provider or inactive plan', async () => {
    const service = createSubscriptionService({
      db: { async query() { return { rows: [] }; } },
      queries: {
        async findProviderById() {
          return { id: 'provider-1', moderation_state: 'approved', visibility: 'private' };
        },
        async findProviderPlanById() {
          return { id: 'plan-1', provider_id: 'provider-1', status: 'draft', pricing: { amountMinor: 0 } };
        },
      },
    });

    await assert.rejects(
      service.subscribe({ userId: 'subscriber-1', providerId: 'provider-1', planId: 'plan-1' }),
      { code: 'PROVIDER_NOT_PUBLISHED' },
    );
  });

  it('creates an active free subscription when a public provider has no selected plan', async () => {
    const transaction = {};
    let insertedSubscription;
    let activeSubscription;
    const service = createSubscriptionService({
      db: {
        async tx(callback) { return callback(transaction); },
      },
      queries: {
        async findProviderById() {
          return { id: 'provider-1', moderation_state: 'approved', visibility: 'public' };
        },
        async findExistingSubscriptionForCheckout() { return null; },
        async insertSubscription(client, data) {
          assert.equal(client, transaction);
          insertedSubscription = data;
          return { id: 'subscription-1' };
        },
        async insertSubscriptionEvent(client, event) {
          assert.equal(client, transaction);
          assert.equal(event.eventType, 'created');
        },
        async updateSubscriptionStatus(id, status, client) {
          assert.equal(client, transaction);
          activeSubscription = { id, status };
          return activeSubscription;
        },
      },
      events: {
        async publish(client, type, payload) {
          assert.equal(client, transaction);
          assert.equal(type, 'marketplace.subscription_started');
          assert.equal(payload.subscriptionId, 'subscription-1');
        },
      },
    });

    const result = await service.subscribe({
      userId: 'subscriber-1',
      providerId: 'provider-1',
      workspaceId: 'workspace-1',
    });

    assert.equal(insertedSubscription.planId ?? null, null);
    assert.deepEqual(activeSubscription, { id: 'subscription-1', status: 'active' });
    assert.deepEqual(result, activeSubscription);
  });

  it('returns an existing active subscription when the subscriber retries subscribe', async () => {
    const existing = { id: 'subscription-existing', status: 'active' };
    const service = createSubscriptionService({
      db: {},
      queries: {
        async findProviderById() {
          return { id: 'provider-1', moderation_state: 'approved', visibility: 'public' };
        },
        async findExistingSubscriptionForCheckout() { return existing; },
      },
    });

    assert.equal(await service.subscribe({
      userId: 'subscriber-1',
      providerId: 'provider-1',
    }), existing);
  });

  it('explains when an existing past-due subscription blocks access', async () => {
    const service = createSubscriptionService({
      db: {},
      queries: {
        async findProviderById() {
          return { id: 'provider-1', moderation_state: 'approved', visibility: 'public' };
        },
        async findExistingSubscriptionForCheckout() {
          return { id: 'subscription-past-due', status: 'past_due' };
        },
      },
    });

    await assert.rejects(
      service.subscribe({ userId: 'subscriber-1', providerId: 'provider-1' }),
      { code: 'SUBSCRIPTION_PAYMENT_PAST_DUE', status: 409 },
    );
  });

  it('starts Stripe checkout without activating a paid subscription before its webhook', async () => {
    let checkoutParameters;
    let databaseTransactionStarted = false;
    const service = createSubscriptionService({
      db: {
        async tx(callback) {
          databaseTransactionStarted = true;
          return callback({});
        },
      },
      queries: {
        async findProviderById() {
          return {
            id: 'provider-1',
            moderation_state: 'approved',
            visibility: 'public',
          };
        },
        async findProviderPlanById() {
          return {
            id: 'plan-1',
            provider_id: 'provider-1',
            status: 'active',
            pricing: { amountMinor: 1000, currency: 'USD', billingInterval: 'monthly' },
          };
        },
        async findExistingSubscriptionForCheckout() { return null; },
      },
      stripeMarketplace: {
        async createSubscriptionCheckout(params) {
          checkoutParameters = params;
          return { subscriptionId: 'subscription-1', redirectUrl: 'https://stripe.test/checkout' };
        },
      },
    });

    const result = await service.subscribe({
      userId: 'subscriber-1',
      providerId: 'provider-1',
      planId: 'plan-1',
      workspaceId: 'workspace-1',
    });
    assert.deepEqual(result, {
      subscriptionId: 'subscription-1',
      redirectUrl: 'https://stripe.test/checkout',
    });
    assert.equal(checkoutParameters.userId, 'subscriber-1');
    assert.equal(checkoutParameters.plan.id, 'plan-1');
    assert.equal(databaseTransactionStarted, false);
  });

  it('serializes subscriber profiles without exposing their contact data', () => {
    const subscriber = serializeProviderSubscriber({
      id: 'subscription-1',
      username: 'subscriber',
      display_name: 'Subscriber One',
      status: 'active',
      plan_name: 'Free signals',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      email: 'private@example.test',
    });
    assert.deepEqual(Object.keys(subscriber), [
      'id',
      'username',
      'displayName',
      'status',
      'planName',
      'createdAt',
    ]);
    assert.equal(subscriber.username, 'subscriber');
  });

  it('serializes only the subscriber-facing fields for Stripe subscriptions', () => {
    const subscription = serializeMarketplaceSubscription({
      id: 'subscription-1',
      provider_id: 'provider-1',
      display_name: 'Trader',
      plan_name: 'Premium',
      status: 'subscription_pending',
      pricing: { amountMinor: 1250, currency: 'USD', billingInterval: 'monthly' },
      stripe_checkout_url: 'https://stripe.test/checkout',
      stripe_customer_id: 'private-stripe-customer',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });

    assert.equal(subscription.providerName, 'Trader');
    assert.equal(subscription.price, 12.5);
    assert.equal(subscription.checkoutUrl, 'https://stripe.test/checkout');
    assert.equal('stripe_customer_id' in subscription, false);
  });
});
