/**
 * SyncExc Server — Portfolio aggregation service
 *
 * Calculates account value, exposure, and PnL across connected accounts.
 * Preserves per-account differences rather than forcing a single number.
 */

const USD_PEGGED_ASSETS = new Set(['USD', 'USDT', 'USDC', 'BUSD', 'TUSD', 'FDUSD', 'USDP', 'DAI']);

export function createPortfolioService({ db, queries, marketData, logger }) {
  async function getWorkspaceOverview({ workspaceId }) {
    const spotPricePromises = new Map();
    async function getSpotPrice(exchangeCode, asset) {
      const symbol = exchangeCode === 'okx' ? `${asset}-USDT` : `${asset}USDT`;
      const key = `${exchangeCode}:${symbol}`;
      if (!spotPricePromises.has(key)) {
        spotPricePromises.set(
          key,
          Promise.resolve().then(() => {
            if (typeof marketData?.getSpotPrice !== 'function') {
              throw new Error('Spot price service is unavailable');
            }
            return marketData.getSpotPrice({ exchangeCode, symbol });
          }),
        );
      }
      try {
        return await spotPricePromises.get(key);
      } catch (error) {
        spotPricePromises.delete(key);
        throw error;
      }
    }

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

    const closedTradesResult = await db.query(
      `
      WITH realized_trades AS (
        SELECT realized_pnl, closed_at
        FROM trading_closed_trades
        WHERE workspace_id = $1
        UNION ALL
        SELECT f.realized_pnl, f.executed_at AS closed_at
        FROM trading_fills f
        JOIN trading_orders o ON o.id = f.order_id
        WHERE f.workspace_id = $1
          AND o.market_type = 'spot'
          AND f.realized_pnl IS NOT NULL
      )
      SELECT
        count(*)::int AS closed_trade_count,
        COALESCE(sum(realized_pnl), 0)::text AS total_realized_pnl,
        COALESCE(sum(realized_pnl) FILTER (
          WHERE closed_at >= now() - interval '24 hours'
        ), 0)::text AS realized_pnl_today
      FROM realized_trades
      `,
      [workspaceId]
    );

    const recentTradesResult = await queries.listTradesForScope(workspaceId, { limit: 5 });

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

    const accountRows = accountsResult.rows.map((account) => ({
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
      equity: account.equity == null ? null : Number(account.equity),
      equitySource: account.equity == null ? null : 'exchange',
    }));
    const accounts = await Promise.all(accountRows.map(async (account) => {
      if (account.equity !== null) return { ...account, unpricedAssets: [] };
      if (!Array.isArray(account.balances) || account.balances.length === 0) {
        return { ...account, unpricedAssets: [] };
      }

      let estimatedEquity = 0;
      const unpricedAssets = [];
      await Promise.all(account.balances.map(async (balance) => {
        const asset = String(balance.asset || '').toUpperCase();
        const amount = Number(balance.total);
        if (!asset || !Number.isFinite(amount) || amount < 0) {
          if (asset) unpricedAssets.push(asset);
          return;
        }
        if (amount === 0) return;
        if (USD_PEGGED_ASSETS.has(asset)) {
          estimatedEquity += amount;
          return;
        }

        try {
          const price = await getSpotPrice(account.exchangeName, asset);
          estimatedEquity += amount * price;
        } catch (error) {
          logger?.warn?.(
            { accountId: account.id, asset, errorName: error?.name || 'Error' },
            'Unable to value account balance in USD',
          );
          unpricedAssets.push(asset);
        }
      }));

      return unpricedAssets.length === 0
        ? { ...account, equity: estimatedEquity, equitySource: 'estimated', unpricedAssets }
        : { ...account, unpricedAssets };
    }));
    const connectionCounts = connectionsResult.rows[0] ?? {};
    const valuedAccounts = accounts.filter((account) => account.equity !== null);
    const historyRows = accountRows.length
      ? (await db.query(
        `
        WITH bucketed_snapshots AS (
          SELECT
            bs.id,
            bs.account_id,
            bs.observed_at,
            CASE
              WHEN bs.observed_at >= now() - interval '90 days'
                THEN date_trunc('hour', bs.observed_at)
              ELSE date_trunc('day', bs.observed_at)
            END AS bucket
          FROM exchange_balance_snapshots bs
          JOIN exchange_accounts a ON a.id = bs.account_id
          JOIN exchange_connections c ON c.id = a.connection_id
          WHERE c.workspace_id = $1
            AND c.status NOT IN ('disconnected', 'revoked')
            AND a.status = 'active'
            AND bs.observed_at >= now() - interval '1 year'
        ),
        latest_per_bucket AS (
          SELECT DISTINCT ON (account_id, bucket)
            id, account_id, observed_at, bucket
          FROM bucketed_snapshots
          ORDER BY account_id, bucket, observed_at DESC
        )
        SELECT
          snapshot.bucket,
          snapshot.account_id,
          c.exchange_code,
          snapshot.observed_at,
          (
            SELECT jsonb_agg(jsonb_build_object(
              'asset', item.asset,
              'total', item.total::text
            ) ORDER BY item.asset)
            FROM exchange_balance_items item
            WHERE item.snapshot_id = snapshot.id
          ) AS balances,
          (
            SELECT account_snapshot.equity::text
            FROM exchange_account_snapshots account_snapshot
            WHERE account_snapshot.account_id = snapshot.account_id
              AND account_snapshot.observed_at = snapshot.observed_at
              AND account_snapshot.equity IS NOT NULL
            ORDER BY account_snapshot.id DESC
            LIMIT 1
          ) AS equity
        FROM latest_per_bucket snapshot
        JOIN exchange_accounts a ON a.id = snapshot.account_id
        JOIN exchange_connections c ON c.id = a.connection_id
        ORDER BY snapshot.bucket ASC, snapshot.account_id ASC
        `,
        [workspaceId],
      )).rows
      : [];
    const historyByBucket = new Map();
    for (const row of historyRows) {
      const bucketKey = new Date(row.bucket).toISOString();
      if (!historyByBucket.has(bucketKey)) historyByBucket.set(bucketKey, []);
      historyByBucket.get(bucketKey).push(row);
    }
    const history = [];
    for (const [bucket, rows] of historyByBucket) {
      if (rows.length !== accountRows.length) continue;
      let value = 0;
      let isComplete = true;
      for (const row of rows) {
        if (row.equity !== null && row.equity !== undefined) {
          const equity = Number(row.equity);
          if (!Number.isFinite(equity)) {
            isComplete = false;
            break;
          }
          value += equity;
          continue;
        }

        const balances = Array.isArray(row.balances) ? row.balances : [];
        if (balances.length === 0) {
          isComplete = false;
          break;
        }
        for (const balance of balances) {
          const asset = String(balance.asset || '').toUpperCase();
          const amount = Number(balance.total);
          if (!asset || !Number.isFinite(amount) || amount < 0) {
            isComplete = false;
            break;
          }
          if (amount === 0) continue;
          if (USD_PEGGED_ASSETS.has(asset)) {
            value += amount;
            continue;
          }
          try {
            value += amount * await getSpotPrice(row.exchange_code, asset);
          } catch (error) {
            logger?.warn?.(
              { accountId: row.account_id, asset, errorName: error?.name || 'Error' },
              'Unable to value historical account balance',
            );
            isComplete = false;
            break;
          }
        }
        if (!isComplete) break;
      }
      if (isComplete) history.push({ timestamp: bucket, value });
    }
    const now = Date.now();
    const ranges = {
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    };
    const equitySeries = {};
    const equityChange = {};
    for (const [range, duration] of Object.entries(ranges)) {
      const series = history.filter((point) => Date.parse(point.timestamp) >= now - duration);
      equitySeries[range] = series;
      if (series.length >= 2) {
        const first = series[0].value;
        const last = series[series.length - 1].value;
        equityChange[range] = {
          absolute: last - first,
          percent: first === 0 ? null : ((last - first) / Math.abs(first)) * 100,
        };
      }
    }

    return {
      accounts,
      portfolioValue: accounts.length > 0 && valuedAccounts.length === accounts.length
        ? valuedAccounts.reduce((total, account) => total + account.equity, 0)
        : null,
      portfolioValueEstimated: valuedAccounts.some((account) => account.equitySource === 'estimated'),
      unpricedAssets: [...new Set(accounts.flatMap((account) => account.unpricedAssets))],
      equitySeries,
      equityChange,
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
      closedTrades: {
        count: closedTradesResult.rows[0].closed_trade_count,
        totalRealizedPnl: closedTradesResult.rows[0].total_realized_pnl,
      },
      realizedPnlToday: closedTradesResult.rows[0].realized_pnl_today,
      recentTrades: recentTradesResult.rows.map((trade) => ({
        id: trade.id,
        orderId: trade.order_id || null,
        exchangeTradeId: trade.exchange_trade_id || null,
        instrument: trade.instrument,
        side: trade.side,
        quantity: trade.quantity,
        filledQuantity: trade.quantity,
        entryPrice: trade.entry_price || null,
        price: trade.price,
        averagePrice: trade.price,
        fees: trade.fee_amount || null,
        feeAsset: trade.fee_asset || null,
        realizedPnl: trade.realized_pnl,
        closedAt: trade.executed_at,
        status: trade.realized_pnl === null ? 'filled' : 'closed',
      })),
      recentExecutions: executionsResult.rows,
    };
  }

  return {
    getWorkspaceOverview,
  };
}

export default createPortfolioService;