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

    const accountsResult = await db.query(
      `
      SELECT
        a.id,
        a.connection_id,
        a.account_type,
        a.status,
        c.label,
        c.exchange_code,
        c.status AS connection_status,
        COALESCE(h.state, c.status) AS health_status,
        COALESCE(latest_balance.observed_at, a.last_sync_at) AS last_synced_at,
        latest_balance.items AS balances,
        latest_account.equity
      FROM exchange_accounts a
      JOIN exchange_connections c ON c.id = a.connection_id
      LEFT JOIN exchange_connection_health h ON h.connection_id = c.id
      LEFT JOIN LATERAL (
        SELECT
          bs.observed_at,
          jsonb_agg(
            jsonb_build_object(
              'asset', bi.asset,
              'free', bi.free::text,
              'used', bi.used::text,
              'total', bi.total::text
            )
            ORDER BY bi.asset
          ) AS items
        FROM exchange_balance_snapshots bs
        JOIN exchange_balance_items bi ON bi.snapshot_id = bs.id
        WHERE bs.account_id = a.id
        GROUP BY bs.id, bs.observed_at
        ORDER BY bs.observed_at DESC
        LIMIT 1
      ) latest_balance ON true
      LEFT JOIN LATERAL (
        SELECT snapshot.equity::text AS equity
        FROM exchange_account_snapshots snapshot
        WHERE snapshot.account_id = a.id
          AND snapshot.equity IS NOT NULL
        ORDER BY snapshot.observed_at DESC
        LIMIT 1
      ) latest_account ON true
      WHERE c.workspace_id = $1
        AND c.status NOT IN ('disconnected', 'revoked')
        AND a.status = 'active'
      ORDER BY c.created_at DESC, a.created_at ASC
      `,
      [workspaceId]
    );

    const connectionsResult = await db.query(
      `
      SELECT
        count(*)::int AS total_count,
        count(*) FILTER (WHERE status = 'active')::int AS active_count,
        count(*) FILTER (WHERE status = 'degraded')::int AS degraded_count
      FROM exchange_connections
      WHERE workspace_id = $1
        AND status NOT IN ('disconnected', 'revoked')
      `,
      [workspaceId]
    );

    const accounts = accountsResult.rows.map((account) => ({
      id: account.id,
      connectionId: account.connection_id,
      label: account.label,
      exchangeName: account.exchange_code,
      type: account.account_type,
      status: account.status,
      connectionStatus: account.connection_status,
      healthStatus:
        account.connection_status === 'degraded' ? 'degraded' : account.health_status,
      lastSyncedAt: account.last_synced_at,
      balances: account.balances ?? [],
      equity: account.equity === null ? null : Number(account.equity),
    }));
    const connectionCounts = connectionsResult.rows[0] ?? {};
    const valuedAccounts = accounts.filter((account) => account.equity !== null);

    return {
      accounts,
      portfolioValue: valuedAccounts.length
        ? valuedAccounts.reduce((total, account) => total + account.equity, 0)
        : null,
      baseCurrency: 'USD',
      activeConnectionCount: connectionCounts.active_count ?? 0,
      totalConnectionCount: connectionCounts.total_count ?? 0,
      degradedConnectionCount: connectionCounts.degraded_count ?? 0,
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