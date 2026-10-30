import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateCopyConfigurationRequestSchema } from '@syncexc/shared';
import { createCopyConfigurationService } from '../../src/modules/marketplace/copy-configuration.service.js';
import {
  alignCopyProtectionLevels,
  createCopyOrchestrationService,
  resolveCopyProtectionLevels,
} from '../../src/modules/marketplace/copy-orchestration.service.js';

test('resolves percentage protection in the signal direction and falls back per leg', () => {
  const longProtection = resolveCopyProtectionLevels({
    config: { stop_loss_percent: '2', take_profit_percent: '4' },
    signal: { direction: 'long', stop_loss: '90', targets: ['120'] },
    referencePrice: 100,
  });
  assert.equal(longProtection.stopLoss, '98');
  assert.equal(longProtection.takeProfit, '104');

  const shortProtection = resolveCopyProtectionLevels({
    config: { stop_loss_percent: '2', take_profit_percent: '4' },
    signal: { direction: 'short', stop_loss: '110', targets: ['80'] },
    referencePrice: 100,
  });
  assert.equal(shortProtection.stopLoss, '102');
  assert.equal(shortProtection.takeProfit, '96');

  const fallbackProtection = resolveCopyProtectionLevels({
    config: { stop_loss_percent: null, take_profit_percent: '5' },
    signal: { direction: 'long', stop_loss: '95', targets: [{ price: '110' }] },
    referencePrice: 100,
  });
  assert.equal(fallbackProtection.stopLoss, '95');
  assert.equal(fallbackProtection.takeProfit, '105');
  assert.equal(fallbackProtection.stopLossOverridden, false);
  assert.equal(fallbackProtection.takeProfitOverridden, true);

  const alignedShortProtection = alignCopyProtectionLevels({
    protection: resolveCopyProtectionLevels({
      config: { stop_loss_percent: '2', take_profit_percent: '4' },
      signal: { direction: 'short', stop_loss: null, targets: [] },
      referencePrice: 110.03,
    }),
    tickSize: '0.1',
    direction: 'short',
    referencePrice: 110.03,
  });
  assert.equal(alignedShortProtection.stopLoss, '112.2');
  assert.equal(alignedShortProtection.takeProfit, '105.7');
});

test('validates copy protection percentage overrides in the shared request schema', () => {
  const valid = CreateCopyConfigurationRequestSchema.validate({
    providerId: '4e132c7c-8a3b-4e90-a8df-e2cbe187d2ce',
    destinationAccounts: [{
      connectionId: '513a145c-444e-47ce-81c3-2b9c06619e36',
      accountId: '1e07b8ae-fce5-43d2-8ec4-f63f2f754d08',
    }],
    marketTypes: ['futures'],
    sizingRule: { type: 'fixed_amount', config: { amount: 25 } },
    stopLossPercent: 2,
    takeProfitPercent: 4.5,
    executionMode: 'confirm_before_execution',
  });
  assert.equal(valid.error, undefined);

  const invalid = CreateCopyConfigurationRequestSchema.validate({
    providerId: '4e132c7c-8a3b-4e90-a8df-e2cbe187d2ce',
    destinationAccounts: [{
      connectionId: '513a145c-444e-47ce-81c3-2b9c06619e36',
      accountId: '1e07b8ae-fce5-43d2-8ec4-f63f2f754d08',
    }],
    marketTypes: ['futures'],
    sizingRule: { type: 'fixed_amount', config: { amount: 25 } },
    stopLossPercent: 100,
    executionMode: 'confirm_before_execution',
  });
  assert.ok(invalid.error);
});

test('persists protection overrides in a new copy configuration', async () => {
  let inserted;
  const service = createCopyConfigurationService({
    db: {
      async tx(callback) {
        return callback({});
      },
    },
    queries: {
      async findProviderById() {
        return { id: 'provider-1', moderation_state: 'approved', visibility: 'public' };
      },
      async findActiveSubscription() {
        return { id: 'subscription-1' };
      },
      async insertCopyConfiguration(_tx, data) {
        inserted = data;
        return { id: 'config-1', ...data };
      },
      async insertCopyDestination() {},
      async insertCopyConfigurationVersion() {},
      async insertCopyPermissionGrant() {},
    },
    events: { async publish() {} },
  });

  await service.createConfiguration({
    userId: 'user-1',
    workspaceId: 'workspace-1',
    providerId: 'provider-1',
    destinationAccounts: [{ connectionId: 'connection-1', accountId: 'account-1' }],
    marketTypes: ['futures'],
    sizingRule: { type: 'fixed_amount', config: { amount: 25 } },
    stopLossPercent: 2,
    takeProfitPercent: '4.5',
    executionMode: 'confirm_before_execution',
  });

  assert.equal(inserted.stopLossPercent, 2);
  assert.equal(inserted.takeProfitPercent, 4.5);
});

test('uses current market reference and tick-aligned protection overrides in copy execution', async () => {
  let riskPayload;
  let intentPayload;
  let marketPriceRequests = 0;
  const signal = {
    id: 'signal-1',
    provider_id: 'provider-1',
    status: 'published',
    instrument: 'BTCUSDT',
    market_type: 'futures',
    direction: 'long',
    order_type: 'market',
    entry: '100',
    stop_loss: '90',
    targets: ['120'],
    leverage: '1',
  };
  const config = {
    id: 'config-1',
    provider_id: 'provider-1',
    workspace_id: 'workspace-1',
    subscriber_user_id: 'user-1',
    current_version: 1,
    sizing_rule: { type: 'fixed_amount', config: { amount: '0.01' } },
    execution_mode: 'confirm_before_execution',
    stop_loss_percent: '2',
    take_profit_percent: '4',
  };
  const destination = {
    id: 'destination-1',
    account_id: 'account-1',
    connection_id: 'connection-1',
    exchange_code: 'bybit',
    connection_status: 'active',
    account_status: 'active',
    account_type: 'unified',
    environment: 'demo',
  };
  const adapter = {
    capabilities: {
      hasFutures: true,
      supportedOrderTypes: ['market'],
      bracketProtection: {
        futures: {
          nativePositionOrderTypes: ['market'],
          entryAttachedConditionalOrderTypes: [],
          postFillConditionalOrderTypes: [],
        },
      },
    },
    async fetchAccountState() {
      return { balances: [{ asset: 'USDT', free: '1000' }] };
    },
  };
  const service = createCopyOrchestrationService({
    db: {
      async tx(callback) {
        return callback({});
      },
    },
    queries: {
      async findPublishedSignalById() {
        return signal;
      },
      async listActiveCopyConfigurationsForProvider() {
        return [config];
      },
      async listCopyDestinations() {
        return [destination];
      },
      async insertCopyProcessingRecord() {
        return { id: 'processing-1' };
      },
      async insertCopyDestinationResult() {},
      async insertCopyExecutionIntent(_tx, { payload }) {
        intentPayload = payload;
        return { id: 'intent-1' };
      },
      async updateCopyProcessingRecord() {},
    },
    risk: {
      evaluation: {
        async evaluate({ operationPayload }) {
          riskPayload = operationPayload;
          return { id: 'risk-1', outcome: 'approved' };
        },
      },
    },
    connections: {
      async getAdapter() {
        return adapter;
      },
      async getInstrument() {
        return {
          trading_status: 'active',
          market_type: 'futures',
          base_asset: 'BTC',
          quote_asset: 'USDT',
          tick_size: '0.1',
        };
      },
      async loadCredentials() {
        return {};
      },
    },
    marketData: {
      async getMarketData() {
        marketPriceRequests += 1;
        return { overview: { lastPrice: '110.03' } };
      },
    },
    events: { async publish() {} },
    logger: { info() {}, warn() {}, error() {} },
  });

  await service.processPublishedSignal({ publishedSignalId: signal.id });

  assert.equal(marketPriceRequests, 1);
  assert.equal(riskPayload.price, 110.03);
  assert.equal(riskPayload.stopLoss, '107.9');
  assert.equal(riskPayload.takeProfit, '114.4');
  assert.equal(intentPayload.stopLoss, '107.9');
  assert.equal(intentPayload.takeProfit, '114.4');
});
