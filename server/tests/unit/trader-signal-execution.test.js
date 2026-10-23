import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTraderSignalExecutionService } from '../../src/modules/marketplace/trader-signal-execution.service.js';

function createDependencies({
  signal,
  percentage = '10',
  accounts = [],
  instrument = {
    trading_status: 'active',
    base_asset: 'BTC',
    quote_asset: 'USDT',
    tick_size: '0.01',
  },
  capabilities = {
    hasSpot: true,
    hasFutures: true,
    hasAttachedBracketProtectionMarkets: ['futures'],
  },
  marketData = { async getSpotPrice() { return 100; } },
}) {
  const submitted = [];
  const records = [];
  const observations = [];
  const closedRecords = [];
  const service = createTraderSignalExecutionService({
    db: {
      async tx(callback) {
        return callback({});
      },
    },
    queries: {
      async findPublishedSignalById() { return signal; },
      async getTraderSignalExecutionPercentage() { return percentage; },
      async listTraderSignalExecutionAccounts() { return accounts; },
      async recordTraderSignalExecution(_tx, record) {
        records.push(record);
      },
      async updateTraderSignalExecutionByOrder() { return []; },
      async findSignalExecutionForClosedTrade() {
        return { id: 'signal-execution-1', signal_id: 'signal-closed-1' };
      },
      async insertSignalExecutionClosedTrade(_tx, record) {
        closedRecords.push(record);
        return record;
      },
    },
    connections: {
      async getAdapter() {
        return {
          capabilities,
          async fetchAccountState({ accountType }) {
            assert.equal(accountType, 'unified');
            return {
              equity: '1000',
              availableEquity: '1000',
              balances: [
                { asset: 'USDT', free: '1000' },
                { asset: 'BTC', free: '2' },
              ],
            };
          },
        };
      },
      async getInstrument() { return instrument; },
      async loadCredentials() { return {}; },
    },
    terminal: {
      async submitOrder(order) {
        submitted.push(order);
        return {
          executionRequest: { id: `execution-${submitted.length}` },
          order: { id: `order-${submitted.length}`, status: 'submitted' },
        };
      },
    },
    marketData,
    performance: {
      async recordObservation(observation) {
        observations.push(observation);
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  });
  return { service, submitted, records, observations, closedRecords };
}

test('submits a limit signal to every matching trader account with percentage sizing', async () => {
  const { service, submitted, records } = createDependencies({
    signal: {
      id: 'signal-1',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      instrument: 'BTCUSDT',
      market_type: 'futures',
      direction: 'long',
      order_type: 'limit',
      entry: null,
      entry_range: { min: '99', max: '101' },
      stop_loss: '90',
      targets: [{ price: '110' }],
      status: 'published',
      source_order_id: null,
    },
    percentage: '10',
    accounts: [
      {
        connection_id: 'connection-1',
        account_id: 'account-1',
        account_type: 'unified',
        exchange_code: 'bybit',
        environment: 'testnet',
      },
      {
        connection_id: 'connection-2',
        account_id: 'account-2',
        account_type: 'unified',
        exchange_code: 'bybit',
        environment: 'testnet',
      },
    ],
  });

  await service.executePublishedSignal({ publishedSignalId: 'signal-1' });

  assert.equal(submitted.length, 2);
  assert.equal(submitted[0].type, 'limit');
  assert.equal(submitted[0].price, '100');
  assert.equal(submitted[0].quantity, '1');
  assert.equal(submitted[0].marketType, 'futures');
  assert.equal(submitted[0].stopLoss, '90');
  assert.equal(submitted[0].takeProfit, '110');
  assert.notEqual(submitted[0].idempotencyKey, submitted[1].idempotencyKey);
  assert.match(submitted[0].idempotencyKey, /^[\da-f]+$/);
  assert.equal(records.length, 2);
  assert.equal(records[0].status, 'submitted');
});

test('sizes market signals from a live market price without sending an entry limit', async () => {
  const { service, submitted } = createDependencies({
    signal: {
      id: 'market-signal',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      instrument: 'BTCUSDT',
      market_type: 'futures',
      direction: 'long',
      order_type: 'market',
      entry: null,
      stop_loss: '90',
      targets: ['110'],
      status: 'published',
      source_order_id: null,
    },
    accounts: [{
      connection_id: 'connection-1',
      account_id: 'account-1',
      account_type: 'unified',
      exchange_code: 'bybit',
      environment: 'testnet',
    }],
    marketData: {
      async getMarketData({ exchangeCode, symbol, marketType }) {
        assert.equal(exchangeCode, 'bybit');
        assert.equal(symbol, 'BTCUSDT');
        assert.equal(marketType, 'futures');
        return { overview: { lastPrice: 100 } };
      },
    },
  });

  await service.executePublishedSignal({ publishedSignalId: 'market-signal' });

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].type, 'market');
  assert.equal(submitted[0].price, undefined);
  assert.equal(submitted[0].quantity, '1');
  assert.equal(submitted[0].stopLoss, '90');
  assert.equal(submitted[0].takeProfit, '110');
});

test('executes protected Bybit Spot limit signals with the configured balance allocation', async () => {
  const { service, submitted } = createDependencies({
    signal: {
      id: 'spot-limit-signal',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      instrument: 'BTCUSDT',
      market_type: 'spot',
      direction: 'long',
      order_type: 'limit',
      entry: '100',
      stop_loss: '90',
      targets: ['110'],
      status: 'published',
      source_order_id: null,
    },
    capabilities: {
      hasSpot: true,
      hasFutures: true,
      hasAttachedBracketProtectionMarkets: ['spot', 'futures'],
      hasAttachedBracketProtectionOrderTypes: {
        spot: ['limit'],
        futures: ['market', 'limit'],
      },
    },
    accounts: [{
      connection_id: 'connection-1',
      account_id: 'account-1',
      account_type: 'unified',
      exchange_code: 'bybit',
      environment: 'testnet',
    }],
  });

  await service.executePublishedSignal({ publishedSignalId: 'spot-limit-signal' });

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].marketType, 'spot');
  assert.equal(submitted[0].type, 'limit');
  assert.equal(submitted[0].price, '100');
  assert.equal(submitted[0].quantity, '1');
  assert.equal(submitted[0].stopLoss, '90');
  assert.equal(submitted[0].takeProfit, '110');
});

test('uses a protected IOC limit with a 0.5 percent slippage cap for Spot market signals', async () => {
  const { service, submitted } = createDependencies({
    signal: {
      id: 'spot-market-signal',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      instrument: 'BTCUSDT',
      market_type: 'spot',
      direction: 'long',
      order_type: 'market',
      entry: null,
      stop_loss: '90',
      targets: ['110'],
      status: 'published',
      source_order_id: null,
    },
    capabilities: {
      hasSpot: true,
      hasFutures: true,
      hasAttachedBracketProtectionMarkets: ['spot', 'futures'],
      hasAttachedBracketProtectionOrderTypes: {
        spot: ['limit'],
        futures: ['market', 'limit'],
      },
      protectedMarketOrderFallbacks: {
        spot: {
          orderType: 'limit',
          timeInForce: 'IOC',
          maxSlippageBps: 50,
          directions: ['long'],
        },
      },
    },
    accounts: [{
      connection_id: 'connection-1',
      account_id: 'account-1',
      account_type: 'unified',
      exchange_code: 'bybit',
      environment: 'testnet',
    }],
    marketData: { async getSpotPrice() { return 100; } },
  });

  await service.executePublishedSignal({ publishedSignalId: 'spot-market-signal' });

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].type, 'limit');
  assert.equal(submitted[0].price, '100.5');
  assert.equal(submitted[0].timeInForce, 'IOC');
  assert.equal(submitted[0].quantity, '1');
  assert.equal(submitted[0].stopLoss, '90');
  assert.equal(submitted[0].takeProfit, '110');
});

test('rounds protected Spot market price caps correctly for tiny decimal tick sizes', async () => {
  const { service, submitted } = createDependencies({
    signal: {
      id: 'tiny-price-signal',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      instrument: 'TINYUSDT',
      market_type: 'spot',
      direction: 'long',
      order_type: 'market',
      entry: null,
      stop_loss: '0.00000001',
      targets: ['0.00000002'],
      status: 'published',
      source_order_id: null,
    },
    instrument: {
      trading_status: 'active',
      base_asset: 'TINY',
      quote_asset: 'USDT',
      tick_size: '0.0000000001',
    },
    capabilities: {
      hasSpot: true,
      hasFutures: false,
      hasAttachedBracketProtectionMarkets: ['spot'],
      hasAttachedBracketProtectionOrderTypes: { spot: ['limit'] },
      protectedMarketOrderFallbacks: {
        spot: {
          orderType: 'limit',
          timeInForce: 'IOC',
          maxSlippageBps: 50,
          directions: ['long'],
        },
      },
    },
    accounts: [{
      connection_id: 'connection-1',
      account_id: 'account-1',
      account_type: 'unified',
      exchange_code: 'bybit',
      environment: 'testnet',
    }],
    marketData: { async getSpotPrice() { return 0.00000001234; } },
  });

  await service.executePublishedSignal({ publishedSignalId: 'tiny-price-signal' });

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].price, '0.0000000124');
});

test('blocks Spot short signal execution instead of submitting an unprotected sell', async () => {
  const { service, submitted, records } = createDependencies({
    signal: {
      id: 'spot-short-signal',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      instrument: 'BTCUSDT',
      market_type: 'spot',
      direction: 'short',
      order_type: 'limit',
      entry: '100',
      stop_loss: '110',
      targets: ['90'],
      status: 'published',
      source_order_id: null,
    },
    capabilities: {
      hasSpot: true,
      hasFutures: false,
      hasAttachedBracketProtectionMarkets: ['spot'],
      hasAttachedBracketProtectionOrderTypes: { spot: ['limit'] },
    },
    accounts: [{
      connection_id: 'connection-1',
      account_id: 'account-1',
      account_type: 'unified',
      exchange_code: 'bybit',
      environment: 'testnet',
    }],
  });

  await service.executePublishedSignal({ publishedSignalId: 'spot-short-signal' });

  assert.equal(submitted.length, 0);
  assert.equal(records[0].status, 'skipped_protection_unsupported');
  assert.match(records[0].errorMessage, /cannot open short positions/);
});

test('does not execute a terminal fill that was already traded before auto-publication', async () => {
  const { service, submitted } = createDependencies({
    signal: {
      id: 'signal-2',
      source_order_id: 'existing-order',
      status: 'published',
    },
  });

  await service.executePublishedSignal({ publishedSignalId: 'signal-2' });

  assert.equal(submitted.length, 0);
});

test('does not execute when the trader has not configured a balance percentage', async () => {
  const accounts = [{
    connection_id: 'connection-1',
    account_id: 'account-1',
    account_type: 'unified',
    exchange_code: 'bybit',
    environment: 'testnet',
  }];
  const { service, submitted } = createDependencies({
    signal: {
      id: 'signal-3',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      status: 'published',
      source_order_id: null,
    },
    percentage: null,
    accounts,
  });

  await service.executePublishedSignal({ publishedSignalId: 'signal-3' });

  assert.equal(submitted.length, 0);
});

test('records why spot trader-side execution was skipped when bracket protection is unsupported', async () => {
  const accounts = [{
    connection_id: 'connection-1',
    account_id: 'account-1',
    account_type: 'unified',
    exchange_code: 'bybit',
    environment: 'testnet',
  }];
  const { service, submitted, records } = createDependencies({
    signal: {
      id: 'spot-signal',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      instrument: 'BTCUSDT',
      market_type: 'spot',
      direction: 'long',
      order_type: 'market',
      entry: null,
      stop_loss: '90',
      targets: ['110'],
      status: 'published',
      source_order_id: null,
    },
    accounts,
    marketData: {
      async getSpotPrice() { return 100; },
    },
  });

  await service.executePublishedSignal({ publishedSignalId: 'spot-signal' });

  assert.equal(submitted.length, 0);
  assert.equal(records[0].status, 'skipped_protection_unsupported');
  assert.match(records[0].errorMessage, /attached stop-loss and take-profit support for spot/);
});

test('records realized signal PnL only after an exact exchange order link', async () => {
  const { service, observations, closedRecords } = createDependencies({
    signal: { id: 'signal-closed-1', status: 'published', source_order_id: null },
  });

  await service.handleClosedTrade({
    closedTradeId: 'closed-trade-1',
    accountId: 'account-1',
    exchangeOrderId: 'exchange-entry-order-1',
    instrument: 'BTCUSDT',
    realizedPnl: '12.5',
    closedAt: '2026-10-23T10:00:00.000Z',
  });

  assert.equal(observations.length, 1);
  assert.equal(observations[0].outcome, 'win');
  assert.equal(observations[0].sourceClosedTradeId, 'closed-trade-1');
  assert.equal(observations[0].evidence.realizedPnl, '12.5');
  assert.equal(closedRecords[0].closedTradeId, 'closed-trade-1');
});
