/**
 * SyncExc Server — Metrics service
 *
 * Computes performance metrics from simulated runs. Every metric is
 * calculated from real data: equity curve, fills, positions, cost events.
 */

export function createMetricsService({ db, queries, logger }) {
  /**
   * Compute the full metric set for a run.
   */
  async function computeMetrics({ runId }) {
    const run = await queries.findRunById(runId);
    if (!run) throw new Error('Run not found');

    const accounts = await queries.listAccountsForEnvironment(run.environment_id);
    if (accounts.length === 0) {
      return defaultMetrics();
    }
    const account = accounts[0];

    const startingBalance = Number(
      (run.config.startingBalances && Object.values(run.config.startingBalances)[0]) || 10000
    );

    // Current balances
    const balances = await queries.listBalances(account.id);
    const usdtBalance = balances.find((b) => b.asset === 'USDT');
    const endingBalance = usdtBalance ? Number(usdtBalance.total) : startingBalance;

    // Positions
    const positions = await queries.listPositionsForRun(runId);
    const unrealizedPnl = positions.reduce((sum, p) => sum + Number(p.unrealized_pnl || 0), 0);
    const realizedPnl = positions.reduce((sum, p) => sum + Number(p.realized_pnl || 0), 0);

    // Fills
    const fills = await queries.listFillsForRun(runId);
    const orders = await queries.listOrdersForRun(runId);

    // Costs
    const costResult = await db.query(
      `
      SELECT cost_type, sum(amount::numeric)::text AS total
      FROM simulation_cost_events
      WHERE run_id = $1
      GROUP BY cost_type
      `,
      [runId]
    );
    const costsByType = costResult.rows.reduce((acc, r) => {
      acc[r.cost_type] = Number(r.total);
      return acc;
    }, {});
    const totalCosts = Object.values(costsByType).reduce((a, b) => a + b, 0);

    // Equity curve — cumulative equity at each fill timestamp
    const equityCurve = await buildEquityCurve({ runId, accountId: account.id, startingBalance });

    // Compute drawdown
    const drawdown = computeMaxDrawdown(equityCurve);

    // Compute win/loss classification from closed round-trips
    const tradeStats = classifyTrades({ fills, orders });

    const netPnl = endingBalance - startingBalance + unrealizedPnl;

    const metrics = {
      startingBalance: startingBalance.toFixed(8),
      endingBalance: endingBalance.toFixed(8),
      grossPnl: (endingBalance - startingBalance).toFixed(8),
      unrealizedPnl: unrealizedPnl.toFixed(8),
      realizedPnl: realizedPnl.toFixed(8),
      netPnl: netPnl.toFixed(8),
      totalCosts: totalCosts.toFixed(8),
      costsByType,

      fillCount: fills.length,
      orderCount: orders.length,
      rejections: orders.filter((o) => o.status === 'rejected').length,

      winRate: tradeStats.winRate,
      profitFactor: tradeStats.profitFactor,
      averageWin: tradeStats.averageWin,
      averageLoss: tradeStats.averageLoss,
      largestWin: tradeStats.largestWin,
      largestLoss: tradeStats.largestLoss,

      maxDrawdown: drawdown.maxDrawdown.toFixed(8),
      maxDrawdownPct: drawdown.maxDrawdownPct.toFixed(4),
      equityCurvePoints: equityCurve.length,
    };

    // Persist each metric
    await db.tx(async (tx) => {
      for (const [name, value] of Object.entries(metrics)) {
        if (typeof value === 'object') {
          await queries.upsertMetric(tx, {
            runId,
            metricName: name,
            metricValue: null,
            metadata: value,
          });
        } else {
          await queries.upsertMetric(tx, {
            runId,
            metricName: name,
            metricValue: typeof value === 'number' ? String(value) : value,
          });
        }
      }
    });

    return metrics;
  }

  async function buildEquityCurve({ runId, accountId, startingBalance }) {
    const fills = await queries.listFillsForRun(runId);
    const curve = [{ t: 0, equity: startingBalance }];

    let balance = startingBalance;
    for (let i = 0; i < fills.length; i += 1) {
      const fill = fills[i];
      const notional = Number(fill.quantity) * Number(fill.price);
      const fee = Number(fill.fee || 0);
      // Simple approximation for spot equity
      balance -= fee;
      curve.push({
        t: i + 1,
        equity: balance,
        timestamp: fill.executed_at,
      });
    }
    return curve;
  }

  function computeMaxDrawdown(curve) {
    let peak = -Infinity;
    let maxDD = 0;
    let maxDDPct = 0;

    for (const point of curve) {
      if (point.equity > peak) peak = point.equity;
      const dd = peak - point.equity;
      if (dd > maxDD) maxDD = dd;
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
      if (ddPct > maxDDPct) maxDDPct = ddPct;
    }

    return {
      maxDrawdown: maxDD,
      maxDrawdownPct: maxDDPct,
    };
  }

  function classifyTrades({ fills, orders }) {
    if (fills.length === 0) {
      return {
        winRate: null,
        profitFactor: null,
        averageWin: null,
        averageLoss: null,
        largestWin: null,
        largestLoss: null,
      };
    }

    // For a proper round-trip analysis we'd need to pair buys and sells.
    // Here we compute PnL per fill as (price delta from previous fill for
    // that instrument) * quantity.
    const lastPrice = {};
    const pnls = [];

    for (const fill of fills) {
      const key = fill.order_id;
      const price = Number(fill.price);
      const qty = Number(fill.quantity);
      const order = orders.find((o) => o.id === fill.order_id);
      if (!order) continue;

      const instrument = order.instrument;
      if (lastPrice[instrument] !== undefined) {
        const pnl = order.side === 'buy'
          ? qty * (price - lastPrice[instrument])
          : qty * (lastPrice[instrument] - price);
        pnls.push(pnl);
      }
      lastPrice[instrument] = price;
    }

    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);
    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));

    return {
      winRate: pnls.length > 0 ? (wins.length / pnls.length) * 100 : null,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
      averageWin: wins.length > 0 ? grossWin / wins.length : null,
      averageLoss: losses.length > 0 ? -grossLoss / losses.length : null,
      largestWin: wins.length > 0 ? Math.max(...wins) : null,
      largestLoss: losses.length > 0 ? Math.min(...losses) : null,
    };
  }

  function defaultMetrics() {
    return {
      startingBalance: '0',
      endingBalance: '0',
      grossPnl: '0',
      unrealizedPnl: '0',
      realizedPnl: '0',
      netPnl: '0',
      totalCosts: '0',
      costsByType: {},
      fillCount: 0,
      orderCount: 0,
      rejections: 0,
      winRate: null,
      profitFactor: null,
      averageWin: null,
      averageLoss: null,
      largestWin: null,
      largestLoss: null,
      maxDrawdown: '0',
      maxDrawdownPct: '0',
      equityCurvePoints: 0,
    };
  }

  async function listMetrics({ runId }) {
    return queries.listMetricsForRun(runId);
  }

  return {
    computeMetrics,
    listMetrics,
  };
}

export default createMetricsService;