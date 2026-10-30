/**
 * SyncExc Server — Performance reporting service
 */

import { NotFoundError } from '../../lib/errors.js';

const METHODOLOGY_VERSION = 'v1';

export function createPerformanceService({ db, queries, logger }) {
  /**
   * Compute a performance report for a provider over a period.
   */
  async function computeReport({ providerId, periodStart, periodEnd }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');

    // Gather published signals in the period
    const signalsResult = await db.query(
      `
      SELECT status, count(*)::int AS count
      FROM marketplace_published_signals
      WHERE provider_id = $1
        AND COALESCE(closed_at, created_at) >= $2
        AND COALESCE(closed_at, created_at) <= $3
      GROUP BY status
      `,
      [providerId, periodStart, periodEnd]
    );

    const signalsByStatus = signalsResult.rows.reduce((acc, r) => {
      acc[r.status] = r.count;
      return acc;
    }, {});

    // Observation data
    const observationsResult = await db.query(
      `
      SELECT outcome, count(*)::int AS count
      FROM marketplace_performance_observations o
      JOIN marketplace_published_signals s ON s.id = o.signal_id
      WHERE s.provider_id = $1
        AND o.observed_at >= $2
        AND o.observed_at <= $3
      GROUP BY outcome
      `,
      [providerId, periodStart, periodEnd]
    );

    const observationsByOutcome = observationsResult.rows.reduce((acc, r) => {
      acc[r.outcome || 'unknown'] = r.count;
      return acc;
    }, {});

    const exactResults = await db.query(
      `
      WITH execution_pnl AS (
        SELECT
          execution.id AS execution_id,
          COALESCE(NULLIF(closed_trade.pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
          SUM(exchange_trade.realized_pnl) AS realized_pnl
        FROM marketplace_signal_closed_trades closed_trade
        JOIN trading_closed_trades exchange_trade
          ON exchange_trade.id = closed_trade.closed_trade_id
        JOIN marketplace_trader_signal_executions execution
          ON execution.id = closed_trade.signal_execution_id
        JOIN marketplace_published_signals signal ON signal.id = execution.signal_id
        WHERE signal.provider_id = $1
          AND signal.source_account_id IS NULL
          AND exchange_trade.closed_at >= $2
          AND exchange_trade.closed_at <= $3
        GROUP BY execution.id, COALESCE(NULLIF(closed_trade.pnl_asset, ''), 'UNKNOWN')
      ),
      source_signal_pnl AS (
        SELECT
          signal.id AS execution_id,
          COALESCE(NULLIF(signal.pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
          SUM(exchange_trade.realized_pnl) AS realized_pnl
        FROM marketplace_published_signals signal
        JOIN trading_closed_trades exchange_trade
          ON (
            (
              signal.source_closed_trade_id IS NOT NULL
              AND exchange_trade.id = signal.source_closed_trade_id
            )
            OR (
              signal.source_closed_trade_id IS NULL
              AND (signal.source_order_id IS NOT NULL OR signal.source_position_snapshot_id IS NOT NULL)
              AND exchange_trade.account_id = signal.source_account_id
              AND exchange_trade.instrument = signal.instrument
              AND exchange_trade.side = signal.direction
              AND exchange_trade.closed_at >= signal.entry_time
              AND exchange_trade.closed_at <= signal.closed_at
            )
          )
        WHERE signal.provider_id = $1
          AND signal.source_account_id IS NOT NULL
          AND signal.status = 'closed'
          AND signal.closed_at IS NOT NULL
          AND exchange_trade.closed_at >= $2
          AND exchange_trade.closed_at <= $3
        GROUP BY signal.id, COALESCE(NULLIF(signal.pnl_asset, ''), 'UNKNOWN')
      ),
      all_pnl AS (
        SELECT * FROM execution_pnl
        UNION ALL
        SELECT * FROM source_signal_pnl
      )
      SELECT
        pnl_asset,
        CASE
          WHEN realized_pnl > 0 THEN 'win'
          WHEN realized_pnl < 0 THEN 'loss'
          ELSE 'breakeven'
        END AS outcome,
        count(*)::int AS count,
        sum(realized_pnl)::text AS realized_pnl
      FROM all_pnl
      GROUP BY pnl_asset, outcome
      `,
      [providerId, periodStart, periodEnd],
    );

    const realizedPnlByAssetAndOutcome = {};
    const exactExecutionOutcomes = {};
    for (const row of exactResults.rows) {
      realizedPnlByAssetAndOutcome[row.pnl_asset] ||= {};
      realizedPnlByAssetAndOutcome[row.pnl_asset][row.outcome] = row.realized_pnl || '0';
      exactExecutionOutcomes[row.outcome] =
        (exactExecutionOutcomes[row.outcome] || 0) + row.count;
    }

    const totalPublished =
      (signalsByStatus.published || 0) +
      (signalsByStatus.updated || 0) +
      (signalsByStatus.closed || 0);
    const observedSignalsResult = await db.query(
      `
      SELECT count(DISTINCT o.signal_id)::int AS count
      FROM marketplace_performance_observations o
      JOIN marketplace_published_signals s ON s.id = o.signal_id
      WHERE s.provider_id = $1
        AND o.observed_at >= $2
        AND o.observed_at <= $3
      `,
      [providerId, periodStart, periodEnd],
    );
    const totalObserved = observedSignalsResult.rows[0]?.count || 0;

    // Data completeness: how many signals have observations?
    const completeness = {
      totalPublished,
      totalObserved,
      completenessPct: totalPublished > 0 ? ((totalObserved / totalPublished) * 100).toFixed(2) : null,
    };

    const metrics = {
      signalsByStatus,
      observationsByOutcome,
      exactExecutionOutcomes,
      realizedPnlByAssetAndOutcome,
      totalPublished,
      totalObserved,
    };

    return db.tx(async (tx) => {
      const report = await queries.insertPerformanceReport(tx, {
        providerId,
        methodologyVersion: METHODOLOGY_VERSION,
        periodStart,
        periodEnd,
        metrics,
        completeness,
      });
      return report;
    });
  }

  async function recordObservation({ signalId, outcome, evidence, observedAt, sourceClosedTradeId, client }) {
    return queries.insertPerformanceObservation(client, {
      signalId,
      observedAt: observedAt || new Date(),
      outcome,
      evidence,
      sourceClosedTradeId,
    });
  }

  async function listReports({ providerId, limit }) {
    return queries.listPerformanceReports(providerId, { limit });
  }

  async function getProviderPerformance({ providerId }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');

    const [signalsResult, metricsResult, seriesResult] = await Promise.all([
      db.query(
        `SELECT count(*)::int AS count
         FROM marketplace_published_signals
         WHERE provider_id = $1 AND status IN ('published', 'updated', 'closed')`,
        [providerId],
      ),
      db.query(
        `
        WITH execution_pnl AS (
          SELECT
            execution.id AS execution_id,
            COALESCE(NULLIF(closed_trade.pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
            SUM(exchange_trade.realized_pnl) AS realized_pnl
          FROM marketplace_signal_closed_trades closed_trade
          JOIN trading_closed_trades exchange_trade
            ON exchange_trade.id = closed_trade.closed_trade_id
          JOIN marketplace_trader_signal_executions execution
            ON execution.id = closed_trade.signal_execution_id
          JOIN marketplace_published_signals signal ON signal.id = execution.signal_id
          WHERE signal.provider_id = $1
            AND signal.source_account_id IS NULL
          GROUP BY execution.id, COALESCE(NULLIF(closed_trade.pnl_asset, ''), 'UNKNOWN')
        ),
        source_signal_pnl AS (
          SELECT
            signal.id AS execution_id,
            COALESCE(NULLIF(signal.pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
            SUM(exchange_trade.realized_pnl) AS realized_pnl
          FROM marketplace_published_signals signal
          JOIN trading_closed_trades exchange_trade
            ON (
              (
                signal.source_closed_trade_id IS NOT NULL
                AND exchange_trade.id = signal.source_closed_trade_id
              )
              OR (
                signal.source_closed_trade_id IS NULL
                AND (signal.source_order_id IS NOT NULL OR signal.source_position_snapshot_id IS NOT NULL)
                AND exchange_trade.account_id = signal.source_account_id
                AND exchange_trade.instrument = signal.instrument
                AND exchange_trade.side = signal.direction
                AND exchange_trade.closed_at >= signal.entry_time
                AND exchange_trade.closed_at <= signal.closed_at
              )
            )
          WHERE signal.provider_id = $1
            AND signal.source_account_id IS NOT NULL
            AND signal.status = 'closed'
            AND signal.closed_at IS NOT NULL
          GROUP BY signal.id, COALESCE(NULLIF(signal.pnl_asset, ''), 'UNKNOWN')
        ),
        all_pnl AS (
          SELECT * FROM execution_pnl
          UNION ALL
          SELECT * FROM source_signal_pnl
        )
        SELECT
          pnl_asset,
          count(*)::int AS observed_executions,
          count(*) FILTER (WHERE realized_pnl > 0)::int AS wins,
          count(*) FILTER (WHERE realized_pnl < 0)::int AS losses,
          count(*) FILTER (WHERE realized_pnl = 0)::int AS breakeven,
          SUM(realized_pnl)::text AS net_pnl
        FROM all_pnl
        GROUP BY pnl_asset
        ORDER BY pnl_asset
        `,
        [providerId],
      ),
      db.query(
        `
        WITH daily_pnl AS (
          SELECT
            COALESCE(NULLIF(closed_trade.pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
            date_trunc('day', exchange_trade.closed_at) AS day,
            SUM(exchange_trade.realized_pnl) AS pnl
          FROM marketplace_signal_closed_trades closed_trade
          JOIN trading_closed_trades exchange_trade
            ON exchange_trade.id = closed_trade.closed_trade_id
          JOIN marketplace_trader_signal_executions execution
            ON execution.id = closed_trade.signal_execution_id
          JOIN marketplace_published_signals signal ON signal.id = execution.signal_id
          WHERE signal.provider_id = $1
            AND signal.source_account_id IS NULL
          GROUP BY
            COALESCE(NULLIF(closed_trade.pnl_asset, ''), 'UNKNOWN'),
            date_trunc('day', exchange_trade.closed_at)
          UNION ALL
          SELECT
            COALESCE(NULLIF(signal.pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
            date_trunc('day', exchange_trade.closed_at) AS day,
            SUM(exchange_trade.realized_pnl) AS pnl
          FROM marketplace_published_signals signal
          JOIN trading_closed_trades exchange_trade
            ON (
              (
                signal.source_closed_trade_id IS NOT NULL
                AND exchange_trade.id = signal.source_closed_trade_id
              )
              OR (
                signal.source_closed_trade_id IS NULL
                AND (signal.source_order_id IS NOT NULL OR signal.source_position_snapshot_id IS NOT NULL)
                AND exchange_trade.account_id = signal.source_account_id
                AND exchange_trade.instrument = signal.instrument
                AND exchange_trade.side = signal.direction
                AND exchange_trade.closed_at >= signal.entry_time
                AND exchange_trade.closed_at <= signal.closed_at
              )
            )
          WHERE signal.provider_id = $1
            AND signal.source_account_id IS NOT NULL
            AND signal.status = 'closed'
            AND signal.closed_at IS NOT NULL
          GROUP BY
            COALESCE(NULLIF(signal.pnl_asset, ''), 'UNKNOWN'),
            date_trunc('day', exchange_trade.closed_at)
        )
        SELECT
          pnl_asset,
          day AS timestamp,
          SUM(pnl) OVER (PARTITION BY pnl_asset ORDER BY day)::text AS value
        FROM daily_pnl
        WHERE pnl_asset <> 'UNKNOWN'
        ORDER BY pnl_asset, day
        `,
        [providerId],
      ),
    ]);

    const seriesByAsset = {};
    for (const point of seriesResult.rows) {
      (seriesByAsset[point.pnl_asset] ||= []).push({
        timestamp: point.timestamp,
        value: Number(point.value),
      });
    }

    for (const [asset, all] of Object.entries(seriesByAsset)) {
      const now = Date.now();
      seriesByAsset[asset] = {
        all,
        '30d': all.filter((point) => new Date(point.timestamp).getTime() >= now - 30 * 86400000),
        '90d': all.filter((point) => new Date(point.timestamp).getTime() >= now - 90 * 86400000),
        '1y': all.filter((point) => new Date(point.timestamp).getTime() >= now - 365 * 86400000),
      };
    }

    const wins = metricsResult.rows.reduce((total, row) => total + row.wins, 0);
    const observedExecutions = metricsResult.rows.reduce(
      (total, row) => total + row.observed_executions,
      0,
    );
    return {
      metrics: {
        totalSignals: signalsResult.rows[0]?.count || 0,
        observedExecutions,
        wins,
        losses: metricsResult.rows.reduce((total, row) => total + row.losses, 0),
        breakeven: metricsResult.rows.reduce((total, row) => total + row.breakeven, 0),
        winRate: observedExecutions > 0 ? (wins / observedExecutions) * 100 : null,
        realizedPnlByAsset: metricsResult.rows.map((row) => ({
          asset: row.pnl_asset,
          observedExecutions: row.observed_executions,
          wins: row.wins,
          losses: row.losses,
          breakeven: row.breakeven,
          netPnl: row.net_pnl,
        })),
      },
      seriesByAsset,
      methodology: {
        source: 'independent',
        description: 'Realized PnL is calculated from closed exchange trades linked to each published signal or copied execution.',
        exclusions: 'Unlinked closed trades are excluded. PnL is kept separate by settlement asset.',
        dataRange: observedExecutions ? 'All linked closed-trade observations' : 'No linked closed-trade observations',
        methodologyVersion: METHODOLOGY_VERSION,
      },
    };
  }

  return {
    computeReport,
    recordObservation,
    listReports,
    getProviderPerformance,
  };
}

export default createPerformanceService;