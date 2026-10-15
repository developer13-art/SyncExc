/**
 * SyncExc Server — Admin refund service
 *
 * Refunds require separation of duties. High-value refunds require a second
 * approver. Every state change is audited.
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

const HIGH_VALUE_THRESHOLD_MINOR = 100000; // $1,000 in minor units

export function createAdminRefundService({ db, queries, billing, approvals, events, audit, logger }) {
  async function initiateRefund({
    userId,
    paymentId,
    amountMinor,
    currency,
    reason,
  }) {
    const payment = await db.query(
      `SELECT * FROM subscription_payments WHERE id = $1`,
      [paymentId]
    );
    if (payment.rows.length === 0) throw new NotFoundError('Payment');
    const p = payment.rows[0];

    if (p.status !== 'succeeded' && p.status !== 'partially_refunded') {
      throw new ConflictError('Payment is not refundable', 'NOT_REFUNDABLE');
    }

    // Check cumulative refunds don't exceed original
    const existingRefunds = await db.query(
      `
      SELECT COALESCE(sum(amount_minor), 0)::text AS total
      FROM refund_records
      WHERE payment_id = $1 AND status NOT IN ('rejected', 'failed')
      `,
      [paymentId]
    );
    const totalRefunded = Number(existingRefunds.rows[0].total);
    const remaining = Number(p.amount_minor) - totalRefunded;

    if (amountMinor > remaining) {
      throw new ConflictError('Refund exceeds remaining refundable amount', 'EXCEEDS_REMAINING');
    }

    // High-value refunds require approval
    const isHighValue = amountMinor >= HIGH_VALUE_THRESHOLD_MINOR;

    if (isHighValue && approvals.isProtected('refund.high_value')) {
      const approval = await approvals.requestApproval({
        actionType: 'refund.high_value',
        actionPayload: { paymentId, amountMinor, currency, reason },
        requestedBy: userId,
        reason,
      });
      return { requiresApproval: true, approval };
    }

    // Create the refund record and process immediately
    const refund = await db.tx(async (tx) => {
      const created = await tx.query(
        `
        INSERT INTO refund_records (
          payment_id, amount_minor, currency, reason, status, requested_by
        )
        VALUES ($1, $2, $3, $4, 'requested', $5)
        RETURNING *
        `,
        [paymentId, amountMinor, currency, reason, userId]
      );

      await audit.write({
        actorId: userId,
        action: 'refund.initiated',
        targetResource: 'refund_record',
        targetId: created.rows[0].id,
        after: { paymentId, amountMinor, currency, reason },
        reason,
      });

      return created.rows[0];
    });

    // Process via billing provider adapter (outside the transaction)
    try {
      await processRefundThroughProvider({ refund, payment: p });
    } catch (err) {
      logger.error({ err, refundId: refund.id }, 'Refund provider processing failed');
    }

    return { refund };
  }

  async function processRefundThroughProvider({ refund, payment }) {
    const provider = await billing.providerFactory.get(payment.provider);
    if (!provider || !provider.refundPayment) {
      logger.warn(
        { provider: payment.provider },
        'Provider does not support refunds'
      );
      return;
    }

    const result = await provider.refundPayment({
      providerPaymentReference: payment.provider_payment_reference,
      amountMinor: Number(refund.amount_minor),
      reason: refund.reason,
    });

    await db.tx(async (tx) => {
      await tx.query(
        `
        UPDATE refund_records
        SET status = 'processing',
            provider_refund_reference = $2
        WHERE id = $1
        `,
        [refund.id, result.id]
      );

      await audit.write({
        actorId: null,
        action: 'refund.submitted_to_provider',
        targetResource: 'refund_record',
        targetId: refund.id,
        after: { providerRefundReference: result.id },
      });
    });
  }

  async function approveRefund({ approvalId, approverId, reason }) {
    return approvals.decide({
      approvalId,
      decidedBy: approverId,
      decision: 'approved',
      reason,
    });
  }

  async function rejectRefund({ approvalId, approverId, reason }) {
    return approvals.decide({
      approvalId,
      decidedBy: approverId,
      decision: 'rejected',
      reason,
    });
  }

  async function listRefunds({ status, limit = 50 } = {}) {
    const params = [limit];
    let stateClause = '';
    if (status) {
      params.push(status);
      stateClause = `WHERE status = $${params.length}`;
    }
    const result = await db.query(
      `
      SELECT r.*, u.email AS requested_by_email
      FROM refund_records r
      LEFT JOIN users u ON u.id = r.requested_by
      ${stateClause}
      ORDER BY r.created_at DESC
      LIMIT $1
      `,
      params
    );
    return result.rows;
  }

  async function getRefund({ refundId, actorId }) {
    const result = await db.query(
      `
      SELECT r.*, p.provider, p.provider_payment_reference, p.amount_minor AS payment_amount_minor, p.currency AS payment_currency
      FROM refund_records r
      JOIN subscription_payments p ON p.id = r.payment_id
      WHERE r.id = $1
      `,
      [refundId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Refund');

    await audit.write({
      actorId,
      action: 'refund.viewed',
      targetResource: 'refund_record',
      targetId: refundId,
    });

    return result.rows[0];
  }

  return {
    initiateRefund,
    approveRefund,
    rejectRefund,
    listRefunds,
    getRefund,
  };
}

export default createAdminRefundService;