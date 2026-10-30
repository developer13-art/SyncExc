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
    quantity_step: '0.001',
    minimum_quantity: '0.001',
  },
  capabilities = {
    hasSpot: true,
    hasFutures: true,
    hasAttachedBracketProtectionMarkets: ['futures'],
  },
  marketData = { async getSpotPrice() { return 100; } },
  accountStateByExchange = {},
  executionForClosedTrade = { id: 'signal-execution-1', signal_id: 'signal-closed-1' },
  sourceSignalClosed = null,
}) {
  const submitted = [];
  const records = [];
  const observations = [];
  const closedRecords = [];
  const sourceCloseRequests = [];
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
        return executionForClosedTrade;
      },
      async insertSignalExecutionClosedTrade(_tx, record) {
        closedRecords.push(record);
        return record;
      },
      async closeSourceSignalForClosedTrade(_tx, record) {
        sourceCloseRequests.push(record);
        return sourceSignalClosed;
      },
      async hasActiveSourceSignalForClosedTrade() {
        return false;
      },
    },
    connections: {
      async getAdapter(exchangeCode) {
        return {
          capabilities,
          async fetchAccountState({ accountType }) {
            assert.equal(accountType, 'unified');
            return accountStateByExchange[exchangeCode] || {
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
      async requireVerifiedPermission() {},
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
  return { service, submitted, records, observations, closedRecords, sourceCloseRequests };
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

test('blocks publication before dispatch when any selected trader account is underfunded', async () => {
  const { service, submitted, records } = createDependencies({
    signal: {
      id: 'private-size-signal',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      instrument: 'BTCUSDT',
      market_type: 'spot',
      direction: 'long',
      order_type: 'limit',
      entry: '100',
      stop_loss: '90',
      targets: ['110'],
      status: 'draft',
      source_order_id: null,
    },
    capabilities: {
      hasSpot: true,
      hasFutures: true,
      hasAttachedBracketProtectionMarkets: ['spot'],
      hasAttachedBracketProtectionOrderTypes: { spot: ['limit'] },
    },
    accounts: [
      {
        connection_id: 'connection-low',
        account_id: 'account-low',
        account_type: 'unified',
        exchange_code: 'bybit',
        environment: 'testnet',
        connection_status: 'active',
        account_status: 'active',
      },
      {
        connection_id: 'connection-ready',
        account_id: 'account-ready',
        account_type: 'unified',
        exchange_code: 'binance',
        environment: 'testnet',
        connection_status: 'active',
        account_status: 'active',
      },
    ],
    accountStateByExchange: {
      bybit: {
        availableEquity: '50',
        balances: [{ asset: 'USDT', free: '50' }],
      },
      binance: {
        availableEquity: '1000',
        balances: [{ asset: 'USDT', free: '1000' }],
      },
    },
  });

  await assert.rejects(
    service.executeSignalForPublication({
      signal: {
        id: 'private-size-signal',
        user_id: 'trader-1',
        workspace_id: 'workspace-1',
        instrument: 'BTCUSDT',
        market_type: 'spot',
        direction: 'long',
        order_type: 'limit',
        entry: '100',
        stop_loss: '90',
        targets: ['110'],
        status: 'draft',
      },
      accountIds: ['account-low', 'account-ready'],
      amount: '200',
    }),
    (error) => error.code === 'SIGNAL_PREFLIGHT_FAILED' &&
      error.details.accounts.some((account) => account.accountId === 'account-low' && !account.valid),
  );

  assert.equal(submitted.length, 0);
  assert.equal(records.length, 0);
});

test('skips Spot market TP/SL when only a Spot limit bracket is declared', async () => {
  const { service, submitted, records } = createDependencies({
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

  assert.equal(submitted.length, 0);
  assert.equal(records[0].status, 'skipped_protection_unsupported');
  assert.match(records[0].errorMessage, /Spot market orders do not have declared/);
  assert.match(records[0].errorMessage, /Post-fill trigger emulation is not enabled/);
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

test('mirrors a terminal fill to the trader’s other accounts, not its source account', async () => {
  const { service, submitted, records } = createDependencies({
    signal: {
      id: 'signal-2',
      source_order_id: 'existing-order',
      source_account_id: 'account-source',
      user_id: 'trader-1',
      workspace_id: 'workspace-1',
      instrument: 'BTCUSDT',
      market_type: 'spot',
      direction: 'long',
      order_type: 'market',
      stop_loss: null,
      targets: [],
      status: 'published',
    },
    accounts: [
      {
        connection_id: 'connection-source',
        account_id: 'account-source',
        account_type: 'unified',
        exchange_code: 'bybit',
        environment: 'testnet',
      },
      {
        connection_id: 'connection-destination',
        account_id: 'account-destination',
        account_type: 'unified',
        exchange_code: 'bybit',
        environment: 'testnet',
      },
    ],
  });

  await service.executePublishedSignal({ publishedSignalId: 'signal-2' });

  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].accountId, 'account-destination');
  assert.equal(records.length, 1);
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
  assert.match(records[0].errorMessage, /not supported for this market and order type/);
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

test('closes externally sourced marketplace signals with realized exchange PnL', async () => {
  const { service, observations, sourceCloseRequests } = createDependencies({
    executionForClosedTrade: null,
    sourceSignalClosed: {
      id: 'external-signal-1',
      realized_pnl: '4.25',
      pnl_asset: 'USDT',
    },
  });

  await service.handleClosedTrade({
    closedTradeId: 'closed-trade-external',
    accountId: 'account-source',
    instrument: 'BTCUSDT',
    side: 'long',
    realizedPnl: '4.25',
    pnlAsset: 'USDT',
    closedAt: '2026-10-29T10:00:00.000Z',
  });

  assert.equal(sourceCloseRequests.length, 1);
  assert.equal(sourceCloseRequests[0].accountId, 'account-source');
  assert.equal(sourceCloseRequests[0].side, 'long');
  assert.equal(observations.length, 1);
  assert.equal(observations[0].signalId, 'external-signal-1');
  assert.equal(observations[0].outcome, 'win');
});
