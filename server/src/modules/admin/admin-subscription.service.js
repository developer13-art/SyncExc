/**
 * SyncExc Server — Admin subscription service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAdminSubscriptionService({ db, queries, billing, events, audit, logger }) {
  async function searchSubscriptions({ status, planId, scopeType, scopeId, limit = 50, cursor = null } = {}) {
    const params = [limit + 1];
    const conditions = [];
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (planId) {
      params.push(planId);
      conditions.push(`plan_version_id = $${params.length}`);
    }
    if (scopeType) {
      params.push(scopeType);
      conditions.push(`billing_scope_type = $${params.length}`);
    }
    if (scopeId) {
      params.push(scopeId);
      conditions.push(`billing_scope_id = $${params.length}`);
    }
    if (cursor) {
      params.push(cursor);
      conditions.push(`created_at < $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `
      SELECT * FROM subscriptions
      ${where}
      ORDER BY created_at DESC
      LIMIT $1
      `,
      params
    );
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const last = rows[rows.length - 1];
    return {
      rows,
      nextCursor: hasMore && last ? last.created_at.toISOString() : null,
    };
  }

  async function getSubscription({ subscriptionId, actorId }) {
    const subscription = await db.query(
      `SELECT * FROM subscriptions WHERE id = $1`,
      [subscriptionId]
    );
    if (subscription.rows.length === 0) throw new NotFoundError('Subscription');

    const payments = await db.query(
      `
      SELECT * FROM subscription_payments
      WHERE subscription_id = $1
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [subscriptionId]
    );

    const entitlements = await db.query(
      `
      SELECT * FROM subscription_entitlements
      WHERE subscription_id = $1 AND revoked_at IS NULL
      `,
      [subscriptionId]
    );

    await audit.write({
      actorId,
      action: 'subscription.viewed',
      targetResource: 'subscription',
      targetId: subscriptionId,
    });

    return {
      subscription: subscription.rows[0],
      payments: payments.rows,
      entitlements: entitlements.rows,
    };
  }

  async function applyCredit({ subscriptionId, actorId, amountMinor, currency, reason }) {
    return db.tx(async (tx) => {
      await tx.query(
        `
        INSERT INTO billing_adjustments (
          billing_scope_type, billing_scope_id, amount_minor, currency, type, reason, created_by
        )
        SELECT billing_scope_type, billing_scope_id, $2, $3, 'credit', $4, $1
        FROM subscriptions WHERE id = $5
        `,
        [actorId, amountMinor, currency, reason, subscriptionId]
      );

      await audit.write({
        actorId,
        action: 'subscription.credit_applied',
        targetResource: 'subscription',
        targetId: subscriptionId,
        after: { amountMinor, currency, reason },
        reason,
      });

      return { ok: true };
    });
  }

  return {
    searchSubscriptions,
    getSubscription,
    applyCredit,
  };
}

export default createAdminSubscriptionService;