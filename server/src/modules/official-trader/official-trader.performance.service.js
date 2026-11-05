/**
 * SyncExc Server — Official AI Trader performance
 *
 * Performance is derived exclusively from exchange-reconciled executions and
 * closed-trade attribution rows. Nothing here reads analyses, backtests, or
 * simulated results. Open positions are reported separately and never counted
 * as realized outcomes.
 */

import { NotFoundError } from '../../lib/errors.js';

const METHODOLOGY_VERSION = 'official-v1';

const PUBLISHED_ANALYSIS_STATUSES = ['executed', 'partially_executed', 'published'];

export function createOfficialTraderPerformanceService({
  db,
  queries,
  logger,
  getProvider,
  recordEvent,
  audit,
}) {
  async function loadProvider(providerId) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    if (providerId && provider.id !== providerId) {
      throw new NotFoundError('Official AI Trader provider');
    }
    return provider;
  }

  function periodFilter(periodStart, periodEnd, column, values) {
    const clauses = [];
    if (periodStart) {
      values.push(periodStart);
      clauses.push(`${column} >= $${values.length}`);
    }
    if (periodEnd) {
      values.push(periodEnd);
      clauses.push(`${column} <= $${values.length}`);
    }
    return clauses.length ? ` AND ${clauses.join(' AND ')}` : '';
  }

  async function aggregate(providerId, { periodStart = null, periodEnd = null } = {}) {
    const values = [providerId];
    const filter = periodFilter(periodStart, periodEnd, 'closure.closed_at', values);
    const [totals, byMarket, byAsset, daily, openAggregates, analysisCounts] = await Promise.all([
      db.query(
        `
        SELECT
          COUNT(*)::int AS closed_trades,
          COUNT(*) FILTER (WHERE closure.outcome = 'win')::int AS wins,
          COUNT(*) FILTER (WHERE closure.outcome = 'loss')::int AS losses,
          COUNT(*) FILTER (WHERE closure.outcome = 'breakeven')::int AS breakeven,
          COALESCE(SUM(closure.realized_pnl), 0)::text AS realized_pnl,
          COALESCE(SUM(closure.fees), 0)::text AS fees,
          COALESCE(AVG(closure.realized_pnl) FILTER (WHERE closure.outcome = 'win'), 0)::text AS average_win,
          COALESCE(AVG(closure.realized_pnl) FILTER (WHERE closure.outcome = 'loss'), 0)::text AS average_loss,
          MAX(closure.closed_at) AS last_closed_at
        FROM official_trader_closures closure
        WHERE closure.provider_id = $1${filter}
        `,
        values,
      ),
      db.query(
        `
        SELECT
          execution.market_type,
          COUNT(*)::int AS closed_trades,
          COUNT(*) FILTER (WHERE closure.outcome = 'win')::int AS wins,
          COUNT(*) FILTER (WHERE closure.outcome = 'loss')::int AS losses,
          COUNT(*) FILTER (WHERE closure.outcome = 'breakeven')::int AS breakeven,
          COALESCE(SUM(closure.realized_pnl), 0)::text AS realized_pnl,
          COALESCE(SUM(closure.fees), 0)::text AS fees
        FROM official_trader_closures closure
        JOIN official_trader_executions execution ON execution.id = closure.execution_id
        WHERE closure.provider_id = $1${filter}
        GROUP BY execution.market_type
        ORDER BY execution.market_type
        `,
        values,
      ),
      db.query(
        `
        SELECT
          COALESCE(NULLIF(closure.pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
          COUNT(*)::int AS closed_trades,
          COUNT(*) FILTER (WHERE closure.outcome = 'win')::int AS wins,
          COUNT(*) FILTER (WHERE closure.outcome = 'loss')::int AS losses,
          COUNT(*) FILTER (WHERE closure.outcome = 'breakeven')::int AS breakeven,
          COALESCE(SUM(closure.realized_pnl), 0)::text AS realized_pnl,
          COALESCE(SUM(closure.fees), 0)::text AS fees
        FROM official_trader_closures closure
        WHERE closure.provider_id = $1${filter}
        GROUP BY COALESCE(NULLIF(closure.pnl_asset, ''), 'UNKNOWN')
        ORDER BY pnl_asset
        `,
        values,
      ),
      db.query(
        `
        WITH daily AS (
          SELECT
            date_trunc('day', closure.closed_at) AS day,
            COALESCE(NULLIF(closure.pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
            SUM(closure.realized_pnl) AS pnl
          FROM official_trader_closures closure
          WHERE closure.provider_id = $1${filter}
          GROUP BY date_trunc('day', closure.closed_at),
                   COALESCE(NULLIF(closure.pnl_asset, ''), 'UNKNOWN')
        )
        SELECT pnl_asset, day AS timestamp,
               SUM(pnl) OVER (PARTITION BY pnl_asset ORDER BY day)::text AS value,
               pnl::text AS daily_value
        FROM daily
        ORDER BY pnl_asset, day
        `,
        values,
      ),
      db.query(
        `
        SELECT
          COUNT(*)::int AS open_positions,
          COALESCE(SUM(COALESCE(execution.filled_quantity, 0) * COALESCE(execution.average_fill_price, 0)), 0)::text AS open_notional,
          COALESCE(SUM(execution.fees), 0)::text AS open_fees
        FROM official_trader_executions execution
        WHERE execution.provider_id = $1
          AND execution.closed_at IS NULL
          AND execution.status IN (
            'pending', 'awaiting_confirmation', 'submitted',
            'partially_filled', 'filled', 'uncertain', 'reconciled'
          )
        `,
        [providerId],
      ),
      queries.countByStatus(providerId, 'official_trader_analyses'),
    ]);

    const total = totals.rows[0] || {};
    const closedTrades = Number(total.closed_trades || 0);
    const wins = Number(total.wins || 0);
    const losses = Number(total.losses || 0);
    const breakeven = Number(total.breakeven || 0);
    const open = openAggregates.rows[0] || {};
    const totalPublished = PUBLISHED_ANALYSIS_STATUSES.reduce(
      (sum, status) => sum + Number(analysisCounts[status] || 0),
      0,
    );

    const seriesByAsset = {};
    for (const point of daily.rows) {
      (seriesByAsset[point.pnl_asset] ||= []).push({
        timestamp: point.timestamp,
        value: Number(point.value),
        dailyValue: Number(point.daily_value),
      });
    }
    for (const asset of Object.keys(seriesByAsset)) {
      const now = Date.now();
      const all = seriesByAsset[asset];
      seriesByAsset[asset] = {
        all,
        '30d': all.filter((point) => new Date(point.timestamp).getTime() >= now - 30 * 86400000),
        '90d': all.filter((point) => new Date(point.timestamp).getTime() >= now - 90 * 86400000),
        '1y': all.filter((point) => new Date(point.timestamp).getTime() >= now - 365 * 86400000),
      };
    }

    return {
      totals: {
        closedTrades,
        wins,
        losses,
        breakeven,
        winRate: closedTrades > 0 ? (wins / closedTrades) * 100 : null,
        realizedPnl: total.realized_pnl || '0',
        fees: total.fees || '0',
        averageWin: total.average_win || '0',
        averageLoss: total.average_loss || '0',
        lastClosedAt: total.last_closed_at || null,
      },
      byMarketType: byMarket.rows.map((row) => ({
        marketType: row.market_type,
        closedTrades: row.closed_trades,
        wins: row.wins,
        losses: row.losses,
        breakeven: row.breakeven,
        winRate: row.closed_trades > 0 ? (row.wins / row.closed_trades) * 100 : null,
        realizedPnl: row.realized_pnl,
        fees: row.fees,
      })),
      byAsset: byAsset.rows.map((row) => ({
        asset: row.pnl_asset,
        closedTrades: row.closed_trades,
        wins: row.wins,
        losses: row.losses,
        breakeven: row.breakeven,
        winRate: row.closed_trades > 0 ? (row.wins / row.closed_trades) * 100 : null,
        realizedPnl: row.realized_pnl,
        fees: row.fees,
      })),
      seriesByAsset,
      open: {
        openPositions: Number(open.open_positions || 0),
        openNotional: open.open_notional || '0',
        openFees: open.open_fees || '0',
        unrealizedStatus: 'not_calculated',
      },
      totalPublished,
      analysisCounts,
    };
  }

  function methodology({ closedTrades }) {
    return {
      source: 'independent',
      official: true,
      calculationBasis: 'exchange_reconciled_executions',
      description:
        'Every result is calculated from exchange-reconciled fills and closed-trade records attributed to an official SyncExc AI Trader execution. Analyses, proposals, backtests, and simulations are never counted as performance.',
      exclusions:
        'Unfilled, rejected, canceled, failed, expired, and research-only analyses are excluded. Open positions are reported separately and are never counted as realized. PnL is kept separate by settlement asset and market type.',
      feesIncluded: true,
      feesNote:
        'Realized PnL uses the exchange-reported net realized result, which includes trading fees and funding where the exchange reports them. Recorded fees are displayed separately for transparency and are not subtracted twice.',
      dataRange: closedTrades > 0
        ? 'All exchange-reconciled closed trades attributed to the official trader'
        : 'No exchange-reconciled closed trades yet',
      methodologyVersion: METHODOLOGY_VERSION,
    };
  }

  function toPublicPerformance(result) {
    return {
      metrics: {
        totalSignals: result.totalPublished,
        observedExecutions: result.totals.closedTrades,
        closedTrades: result.totals.closedTrades,
        wins: result.totals.wins,
        losses: result.totals.losses,
        breakeven: result.totals.breakeven,
        winRate: result.totals.winRate,
        openPositions: result.open.openPositions,
        openNotional: result.open.openNotional,
        byMarketType: result.byMarketType,
        realizedPnlByAsset: result.byAsset.map((row) => ({
          asset: row.asset,
          observedExecutions: row.closedTrades,
          wins: row.wins,
          losses: row.losses,
          breakeven: row.breakeven,
          fees: row.fees,
          netPnl: row.realizedPnl,
        })),
      },
      seriesByAsset: result.seriesByAsset,
      methodology: methodology({ closedTrades: result.totals.closedTrades }),
    };
  }

  async function getPublicPerformance({ providerId }) {
    const provider = await loadProvider(providerId);
    const result = await aggregate(provider.id);
    return toPublicPerformance(result);
  }

  async function getAdminPerformance({ periodStart = null, periodEnd = null } = {}) {
    const provider = await loadProvider();
    const [result, snapshots, closures] = await Promise.all([
      aggregate(provider.id, { periodStart, periodEnd }),
      queries.listPerformanceSnapshots(provider.id, 30),
      queries.listClosures(provider.id, { limit: 50 }),
    ]);
    return {
      providerId: provider.id,
      period: { start: periodStart, end: periodEnd },
      metrics: result.totals,
      byMarketType: result.byMarketType,
      byAsset: result.byAsset,
      seriesByAsset: result.seriesByAsset,
      open: result.open,
      analysisCounts: result.analysisCounts,
      recentClosures: closures.items,
      snapshots,
      methodology: methodology({ closedTrades: result.totals.closedTrades }),
    };
  }

  async function createSnapshot({ periodStart, periodEnd, actorId = null }) {
    const provider = await loadProvider();
    if (!periodStart || !periodEnd) {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      periodEnd = periodEnd || new Date();
      periodStart = periodStart || start;
    }
    const result = await aggregate(provider.id, { periodStart, periodEnd });
    const metrics = {
      totals: result.totals,
      byMarketType: result.byMarketType,
      byAsset: result.byAsset,
      open: result.open,
      totalPublished: result.totalPublished,
      analysisCounts: result.analysisCounts,
    };
    const snapshot = await queries.insertPerformanceSnapshot({
      providerId: provider.id,
      periodStart,
      periodEnd,
      metrics,
      methodology: methodology({ closedTrades: result.totals.closedTrades }),
    });
    await recordEvent({
      providerId: provider.id,
      eventType: 'performance.snapshot',
      message: `Performance snapshot stored for ${new Date(periodStart).toISOString()} – ${new Date(periodEnd).toISOString()}`,
      payload: { periodStart, periodEnd, closedTrades: result.totals.closedTrades },
      actorId,
    });
    if (audit) {
      await audit({
        actorId,
        action: 'official_trader.performance.snapshot',
        targetResource: 'official_trader_performance_snapshots',
        targetId: snapshot.id,
        after: { periodStart, periodEnd, metrics },
      });
    }
    logger.info({ providerId: provider.id, snapshotId: snapshot.id }, 'Official trader performance snapshot stored');
    return { snapshot, metrics };
  }

  return {
    getPublicPerformance,
    getAdminPerformance,
    createSnapshot,
    listClosures: (params) => queries.listClosures(params),
  };
}

export default createOfficialTraderPerformanceService;
