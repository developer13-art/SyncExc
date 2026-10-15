/**
 * SyncExc Server — Backtest engine
 *
 * Runs a strategy/workflow against historical market data:
 *   1. Loads events from a dataset version, ordered by time
 *   2. Processes each event chronologically
 *   3. Dispatches strategy decisions
 *   4. Simulates orders through the fill engine
 *   5. Marks positions to market
 *   6. Emits metrics
 *
 * Every step is recorded for reproducibility. Data is never read beyond
 * the current simulated time (no look-ahead).
 */

import { createLogger } from '../../../lib/logger.js';

const ENGINE_VERSION = 'v1';

export function createBacktestEngine({
  db,
  queries,
  datasetService,
  orderSimulator,
  virtualLedger,
  logger,
}) {
  const log = logger || createLogger({ component: 'simulation:backtest' });

  /**
   * Execute a backtest run.
   *
   * @param {Object} params
   * @param {Object} params.run            The simulation_runs row
   * @param {Object} params.environment    The simulation_environments row
   * @param {Object} params.config         The run config from simulation_runs.config
   * @returns {Promise<Object>}            Execution summary
   */
  async function execute({ run, environment, config }) {
    const startTime = Date.now();
    const warnings = [];
    const stepTraces = [];

    // 1. Load market events
    const datasetVersionId = config.datasetVersionId;
    if (!datasetVersionId) {
      throw new Error('No datasetVersionId configured for run');
    }

    const events = await queries.listMarketEvents({
      datasetVersionId,
      instrument: config.instrument,
      startTime: config.startTime,
      endTime: config.endTime,
      limit: config.maxEvents || 1000000,
    });

    if (events.length === 0) {
      warnings.push('No market events in the configured window');
      return {
        steps: 0,
        eventsProcessed: 0,
        ordersCreated: 0,
        fillsCreated: 0,
        warnings,
      };
    }

    // 2. Load accounts for this environment
    const accounts = await queries.listAccountsForEnvironment(environment.id);
    if (accounts.length === 0) {
      throw new Error('No accounts configured for environment');
    }
    const primaryAccount = accounts[0];

    // 3. Verify starting balances cover intent
    await initializeBalances({
      environment,
      account: primaryAccount,
      config,
    });

    // 4. Process events in chronological order
    let ordersCreated = 0;
    let fillsCreated = 0;
    let stepIndex = 0;
    const marks = {};

    for (const event of events) {
      const payload = event.payload;
      const market = buildMarketSnapshot(event, payload);

      // Track mark price
      if (market.price) marks[event.instrument] = Number(market.price);

      // Strategy decision
      const decision = await decideAction({
        strategy: config.strategy || 'buy_and_hold',
        event,
        market,
        state: { stepIndex, marks },
        config,
      });

      if (decision) {
        const result = await orderSimulator.processOrder({
          runId: run.id,
          accountId: primaryAccount.id,
          order: decision,
          market,
          config: {
            fillModel: config.fillModel || 'immediate_simplified',
            takerFeeBps: config.takerFeeBps || 10,
            slippageBps: config.slippageBps || 5,
            seed: config.randomSeed,
          },
        });

        if (result.order) ordersCreated += 1;
        if (result.fills) fillsCreated += result.fills.length;

        await db.tx(async (tx) => {
          await queries.insertRunStep(tx, {
            runId: run.id,
            stepIndex,
            eventType: event.event_type,
            state: result.rejection ? 'skipped' : 'executed',
            input: { order: decision },
            output: {
              order: result.order,
              fills: result.fills.length,
              rejection: result.rejection,
            },
          });
        });

        stepTraces.push({
          step: stepIndex,
          order: decision.instrument,
          side: decision.side,
          outcome: result.rejection ? 'rejected' : 'filled',
        });
      }

      // Mark to market periodically
      if (stepIndex % 100 === 0) {
        await virtualLedger.markToMarket({
          runId: run.id,
          marks,
        });
      }

      stepIndex += 1;
    }

    // 5. Final mark to market
    await virtualLedger.markToMarket({
      runId: run.id,
      marks,
    });

    const durationMs = Date.now() - startTime;

    return {
      steps: stepIndex,
      eventsProcessed: events.length,
      ordersCreated,
      fillsCreated,
      durationMs,
      warnings,
      stepTraces: stepTraces.slice(-100), // last 100 for the report
    };
  }

  /* ===========================================================================
   * STRATEGY DECISION
   * ======================================================================== */

  async function decideAction({ strategy, event, market, state, config }) {
    switch (strategy) {
      case 'buy_and_hold':
        return buyAndHold({ event, market, state });
      case 'periodic_buy':
        return periodicBuy({ event, market, state, config });
      case 'signal_driven':
        return signalDriven({ event, market, state, config });
      case 'noop':
      default:
        return null;
    }
  }

  function buyAndHold({ event, market, state }) {
    if (state.stepIndex > 0) return null;
    if (!market.price) return null;

    return {
      instrument: event.instrument,
      marketType: config?.marketType || 'spot',
      side: 'buy',
      type: 'market',
      quantity: '1',
      metadata: { strategy: 'buy_and_hold' },
    };
  }

  function periodicBuy({ event, market, state, config }) {
    const interval = config.intervalSteps || 100;
    if (state.stepIndex % interval !== 0) return null;
    if (!market.price) return null;

    return {
      instrument: event.instrument,
      marketType: 'spot',
      side: 'buy',
      type: 'market',
      quantity: config.quantityPerTrade || '0.1',
      metadata: { strategy: 'periodic_buy' },
    };
  }

  function signalDriven({ event, market, state, config }) {
    // In a real deployment this would call the signal pipeline. For
    // deterministic backtests we accept a simple price-cross strategy.
    const fastMa = state.marks[`${event.instrument}:fast`];
    const slowMa = state.marks[`${event.instrument}:slow`];

    const price = Number(market.price || 0);
    if (!price) return null;

    // Update rolling MAs
    const fastPeriod = config.fastPeriod || 10;
    const slowPeriod = config.slowPeriod || 50;
    const history = (state.priceHistory = state.priceHistory || {});
    const arr = (history[event.instrument] = history[event.instrument] || []);
    arr.push(price);
    if (arr.length > slowPeriod) arr.shift();

    if (arr.length >= slowPeriod) {
      const fast = avg(arr.slice(-fastPeriod));
      const slow = avg(arr.slice(-slowPeriod));
      const prevFast = fastMa;
      const prevSlow = slowMa;

      state.marks[`${event.instrument}:fast`] = fast;
      state.marks[`${event.instrument}:slow`] = slow;

      // Golden cross: buy
      if (prevFast !== undefined && prevSlow !== undefined && prevFast <= prevSlow && fast > slow) {
        return {
          instrument: event.instrument,
          marketType: 'spot',
          side: 'buy',
          type: 'market',
          quantity: config.quantityPerTrade || '1',
          metadata: { strategy: 'signal_driven', reason: 'golden_cross' },
        };
      }

      // Death cross: sell
      if (prevFast !== undefined && prevSlow !== undefined && prevFast >= prevSlow && fast < slow) {
        return {
          instrument: event.instrument,
          marketType: 'spot',
          side: 'sell',
          type: 'market',
          quantity: config.quantityPerTrade || '1',
          metadata: { strategy: 'signal_driven', reason: 'death_cross' },
        };
      }
    }

    return null;
  }

  function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /* ===========================================================================
   * HELPERS
   * ======================================================================== */

  function buildMarketSnapshot(event, payload) {
    // For candle events, use the close price at the end of the candle.
    // Data is intentionally capped at the event's own timestamp.
    if (event.event_type === 'trade') {
      return {
        price: payload.price,
        timestamp: event.occurred_at,
        trades: [payload],
      };
    }

    if (event.event_type === 'candle') {
      return {
        price: payload.close,
        open: payload.open,
        high: payload.high,
        low: payload.low,
        close: payload.close,
        volume: payload.volume,
        timestamp: event.occurred_at,
      };
    }

    if (event.event_type === 'order_book') {
      return {
        price: payload.mid,
        depth: {
          bids: payload.bids || [],
          asks: payload.asks || [],
        },
        timestamp: event.occurred_at,
      };
    }

    return {
      price: payload.price,
      timestamp: event.occurred_at,
    };
  }

  async function initializeBalances({ environment, account, config }) {
    const existing = await queries.listBalances(account.id);
    if (existing.length > 0) return;

    const startingBalances = config.startingBalances || environment.settings?.startingBalances || { USDT: '10000' };
    await db.tx(async (tx) => {
      for (const [asset, amount] of Object.entries(startingBalances)) {
        await queries.upsertBalance(tx, {
          accountId: account.id,
          asset,
          free: String(amount),
          used: '0',
          total: String(amount),
        });
        await queries.insertLedgerEntry(tx, {
          accountId: account.id,
          asset,
          amount: String(amount),
          entryType: 'initial_deposit',
          sourceType: 'simulation_init',
        });
      }
    });
  }

  return {
    execute,
    version: ENGINE_VERSION,
  };
}

export default createBacktestEngine;