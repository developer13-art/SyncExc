/**
 * SyncExc Server — Admin workspace service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAdminWorkspaceService({ db, queries, events, audit, logger }) {
  async function searchWorkspaces({ query, type, status, limit = 50, cursor = null, offset } = {}) {
    const params = [limit + 1];
    const conditions = [];
    if (query) {
      params.push(`%${query}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (cursor) {
      params.push(cursor);
      conditions.push(`created_at < $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `
      SELECT w.*, u.email AS owner_email, COUNT(*) OVER () AS total_count
      FROM workspaces w      JOIN users u ON u.id = w.owner_id
      ${where}
      ORDER BY w.created_at DESC
      LIMIT $1
      ${offset === undefined ? '' : `OFFSET $${params.push(offset)}`}
      `,
      params
    );

    const hasMore = result.rows.length > limit;
    const selectedRows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const total = Number(selectedRows[0]?.total_count ?? 0);
    const rows = selectedRows.map(({ total_count: _totalCount, ...row }) => row);
    const last = rows[rows.length - 1];
    return {
      rows,
      nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      total,
    };
  }

  async function getWorkspace({ workspaceId, actorId }) {
    const workspace = await db.query(
      `SELECT * FROM workspaces WHERE id = $1`,
      [workspaceId]
    );
    if (workspace.rows.length === 0) throw new NotFoundError('Workspace');

    const members = await db.query(
      `
      SELECT m.*, u.email AS user_email, u.username
      FROM workspace_memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = $1
      `,
      [workspaceId]
    );

    const subscriptions = await db.query(
      `
      SELECT * FROM subscriptions
      WHERE billing_scope_type = 'workspace' AND billing_scope_id = $1
      ORDER BY created_at DESC
      `,
      [workspaceId]
    );

    const shares = await db.query(
      `
      SELECT * FROM connection_sharing_grants
      WHERE home_workspace_id = $1 OR recipient_workspace_id = $1
      `,
      [workspaceId]
    );

    let traderInsights = null;
    if (workspace.rows[0].type === 'trader') {
      const providerResult = await db.query(
        `SELECT * FROM marketplace_provider_profiles WHERE workspace_id = $1`,
        [workspaceId],
      );
      const provider = providerResult.rows[0] ?? null;
      if (provider) {
        const [balances, subscribers, signals, tradeSummary, trades, signalPnlByAsset, orders] = await Promise.all([
          db.query(
            `
            SELECT currency,
                   COALESCE(SUM(trader_net_amount_minor) FILTER (
                     WHERE status = 'pending' AND payout_request_id IS NULL
                   ), 0)::bigint AS available_minor,
                   COALESCE(SUM(trader_net_amount_minor) FILTER (
                     WHERE status = 'pending' AND payout_request_id IS NOT NULL
                   ), 0)::bigint AS requested_minor,
                   COALESCE(SUM(trader_net_amount_minor) FILTER (WHERE status = 'paid'), 0)::bigint AS paid_minor,
                   COALESCE(SUM(platform_fee_minor) FILTER (WHERE status <> 'reversed'), 0)::bigint AS platform_fee_minor
            FROM marketplace_trader_earnings
            WHERE provider_id = $1
            GROUP BY currency
            ORDER BY currency
            `,
            [provider.id],
          ),
          db.query(
            `
            SELECT subscription.id, subscription.status, subscription.created_at,
                   subscription.current_period_end, subscriber.email AS subscriber_email,
                   subscriber.username AS subscriber_username, plan.name AS plan_name,
                   COALESCE(SUM(earning.gross_amount_minor), 0)::bigint AS gross_paid_minor,
                   COALESCE(SUM(earning.trader_net_amount_minor), 0)::bigint AS trader_net_minor,
                   COALESCE(MAX(earning.currency), plan.pricing->>'currency') AS currency
            FROM marketplace_subscriptions subscription
            JOIN users subscriber ON subscriber.id = subscription.subscriber_user_id
            LEFT JOIN marketplace_provider_plans plan ON plan.id = subscription.plan_id
            LEFT JOIN marketplace_trader_earnings earning
              ON earning.subscription_id = subscription.id AND earning.status <> 'reversed'
            WHERE subscription.provider_id = $1
            GROUP BY subscription.id, subscriber.email, subscriber.username, plan.name, plan.pricing
            ORDER BY subscription.created_at DESC
            LIMIT 50
            `,
            [provider.id],
          ),
          db.query(
            `
            SELECT id, instrument, market_type, direction, status, entry, realized_pnl,
                   pnl_asset, created_at, closed_at
            FROM marketplace_published_signals
            WHERE provider_id = $1
            ORDER BY created_at DESC
            LIMIT 20
            `,
            [provider.id],
          ),
          db.query(
            `
            SELECT COUNT(*)::int AS closed_trade_count,
                   COUNT(*) FILTER (WHERE realized_pnl > 0)::int AS winning_trade_count,
                   COUNT(*) FILTER (WHERE realized_pnl < 0)::int AS losing_trade_count
            FROM trading_closed_trades
            WHERE workspace_id = $1
            `,
            [workspaceId],
          ),
          db.query(
            `
            SELECT id, instrument, side, quantity, entry_price, exit_price, realized_pnl,
                   fee_asset, exchange_code, closed_at
            FROM trading_closed_trades
            WHERE workspace_id = $1
            ORDER BY closed_at DESC
            LIMIT 20
            `,
            [workspaceId],
          ),
          db.query(
            `
            SELECT COALESCE(SUM(realized_pnl), 0)::text AS net_pnl,
                   pnl_asset
            FROM marketplace_published_signals
            WHERE provider_id = $1 AND realized_pnl IS NOT NULL
            GROUP BY pnl_asset
            ORDER BY pnl_asset
            `,
            [provider.id],
          ),
          db.query(
            `
            SELECT status, COUNT(*)::int AS count
            FROM trading_orders
            WHERE workspace_id = $1
            GROUP BY status
            ORDER BY status
            `,
            [workspaceId],
          ),
        ]);
        traderInsights = {
          provider,
          balances: balances.rows,
          subscribers: subscribers.rows,
          signals: signals.rows,
          tradeSummary: tradeSummary.rows[0],
          signalPnlByAsset: signalPnlByAsset.rows,
          trades: trades.rows,
          orders: orders.rows,
        };
      }
    }

    await audit.write({
      actorId,
      action: 'workspace.viewed',
      resourceType: 'workspace',
      resourceId: workspaceId,
    });

    return {
      workspace: workspace.rows[0],
      members: members.rows,
      subscriptions: subscriptions.rows,
      shares: shares.rows,
      traderInsights,
    };
  }

  async function suspendWorkspace({ workspaceId, actorId, reason }) {
    return db.tx(async (tx) => {
      const before = await tx.query(`SELECT status FROM workspaces WHERE id = $1`, [workspaceId]);
      if (before.rows.length === 0) throw new NotFoundError('Workspace');

      const updated = await tx.query(
        `
        UPDATE workspaces SET status = 'suspended', updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [workspaceId]
      );

      await audit.write({
        actorId,
        action: 'workspace.suspended',
        resourceType: 'workspace',
        resourceId: workspaceId,
        before: before.rows[0],
        after: { status: 'suspended' },
        reason,
      });

      return updated.rows[0];
    });
  }

  async function restoreWorkspace({ workspaceId, actorId, reason }) {
    return db.tx(async (tx) => {
      const before = await tx.query(`SELECT status FROM workspaces WHERE id = $1`, [workspaceId]);
      const updated = await tx.query(
        `
        UPDATE workspaces SET status = 'active', updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [workspaceId]
      );

      await audit.write({
        actorId,
        action: 'workspace.restored',
        resourceType: 'workspace',
        resourceId: workspaceId,
        before: before.rows[0],
        after: { status: 'active' },
        reason,
      });

      return updated.rows[0];
    });
  }

  async function revokeShareGrant({ grantId, actorId, reason }) {
    return db.tx(async (tx) => {
      const before = await tx.query(
        `SELECT * FROM connection_sharing_grants WHERE id = $1`,
        [grantId]
      );
      if (before.rows.length === 0) throw new NotFoundError('Grant');

      const updated = await tx.query(
        `
        UPDATE connection_sharing_grants
        SET status = 'revoked', revoked_at = now()
        WHERE id = $1 AND status IN ('pending', 'active')
        RETURNING *
        `,
        [grantId]
      );

      await audit.write({
        actorId,
        action: 'connection_share.revoked',
        resourceType: 'connection_sharing_grant',
        resourceId: grantId,
        before: before.rows[0],
        after: updated.rows[0],
        reason,
      });

      return updated.rows[0];
    });
  }

  return {
    searchWorkspaces,
    getWorkspace,
    suspendWorkspace,
    restoreWorkspace,
    revokeShareGrant,
  };
}

export default createAdminWorkspaceService;