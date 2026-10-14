/**
 * SyncExc Server — Portfolio aggregation service
 *
 * Calculates account value, exposure, and PnL across connected accounts.
 * Preserves per-account differences rather than forcing a single number.
 */

export function createPortfolioService({ db, queries, logger }) {
  async function getWorkspaceOverview({ workspaceId }) {
    // Total orders by status
    const ordersResult = await db.query(
      `
      SELECT status, count(*)::int AS count
      FROM trading_orders
      WHERE workspace_id = $1
      GROUP BY status
      `,
      [workspaceId]
    );

    // Open positions summary
    const positionsResult = await db.query(
      `
      SELECT 
        count(*)::int AS position_count,
        COALESCE(sum(unrealized_pnl), 0)::text AS total_unrealized_pnl
      FROM trading_positions
      WHERE workspace_id = $1 AND quantity > 0
      `,
      [workspaceId]
    );

    // Total fills today
    const fillsResult = await db.query(
      `
      SELECT 
        count(*)::int AS fill_count,
        COALESCE(sum(quantity::numeric * price::numeric), 0)::text AS total_notional
      FROM trading_fills
      WHERE workspace_id = $1 AND executed_at >= now() - interval '24 hours'
      `,
      [workspaceId]
    );

    // Recent executions
    const executionsResult = await db.query(
      `
      SELECT id, operation_type, state, created_at
      FROM trading_execution_requests
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [workspaceId]
    );

    return {
      ordersByStatus: ordersResult.rows.reduce((acc, r) => {
        acc[r.status] = r.count;
        return acc;
      }, {}),
      positions: {
        count: positionsResult.rows[0].position_count,
        totalUnrealizedPnl: positionsResult.rows[0].total_unrealized_pnl,
      },
      fills24h: {
        count: fillsResult.rows[0].fill_count,
        notional: fillsResult.rows[0].total_notional,
      },
      recentExecutions: executionsResult.rows,
    };
  }

  return {
    getWorkspaceOverview,
  };
}

export default createPortfolioService;