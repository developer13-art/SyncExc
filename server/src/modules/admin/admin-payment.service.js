/**
 * SyncExc Server — Admin payment service
 */

export function createAdminPaymentService({ db, queries, audit, logger }) {
  async function searchPayments({ status, provider, userId, from, to, limit = 50, cursor = null } = {}) {
    const params = [limit + 1];
    const conditions = [];
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (provider) {
      params.push(provider);
      conditions.push(`provider = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`created_at <= $${params.length}`);
    }
    if (cursor) {
      params.push(cursor);
      conditions.push(`created_at < $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `
      SELECT * FROM subscription_payments
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

  async function getPayment({ paymentId, actorId }) {
    const payment = await db.query(
      `SELECT * FROM subscription_payments WHERE id = $1`,
      [paymentId]
    );
    if (payment.rows.length === 0) return null;

    const subscription = await db.query(
      `SELECT * FROM subscriptions WHERE id = $1`,
      [payment.rows[0].subscription_id]
    );

    const refunds = await db.query(
      `SELECT * FROM refund_records WHERE payment_id = $1 ORDER BY created_at DESC`,
      [paymentId]
    );

    await audit.write({
      actorId,
      action: 'payment.viewed',
      targetResource: 'subscription_payment',
      targetId: paymentId,
    });

    return {
      payment: payment.rows[0],
      subscription: subscription.rows[0] || null,
      refunds: refunds.rows,
    };
  }

  async function reconcilePayment({ paymentId, actorId, providerRecord }) {
    // Persist reconciliation outcome
    await audit.write({
      actorId,
      action: 'payment.reconciled',
      targetResource: 'subscription_payment',
      targetId: paymentId,
      after: providerRecord,
    });
    return { ok: true };
  }

  return {
    searchPayments,
    getPayment,
    reconcilePayment,
  };
}

export default createAdminPaymentService;