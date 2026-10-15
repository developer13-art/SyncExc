/**
 * SyncExc Server — Commission service
 *
 * Called when a subscription payment succeeds. Determines eligibility,
 * calculates the commission, records it in the ledger.
 */

import { NotFoundError } from '../../lib/errors.js';

export function createCommissionService({
  db,
  queries,
  attributionService,
  eligibilityService,
  ledgerService,
  events,
  logger,
}) {
  /**
   * Process a qualifying payment. Idempotent per (payment_id, type).
   */
  async function processPaymentForCommissions(paymentId) {
    // Load the payment
    const paymentResult = await db.query(
      `SELECT * FROM subscription_payments WHERE id = $1`,
      [paymentId]
    );
    const payment = paymentResult.rows[0];
    if (!payment) throw new NotFoundError('Payment');

    // The subscription's billed user
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE id = $1`,
      [payment.subscription_id]
    );
    const subscription = subResult.rows[0];
    if (!subscription) return null;

    // Determine the referred user
    const referredUserId = subscription.billing_scope_type === 'user'
      ? subscription.billing_scope_id
      : null;
    if (!referredUserId) {
      // Workspace subscriptions don't currently earn commissions
      return null;
    }

    // Find attribution
    const attribution = await attributionService.getAttributionForUser(referredUserId);
    if (!attribution) return null;

    // Count prior qualifying payments for this user
    const priorResult = await db.query(
      `
      SELECT count(*)::int AS count
      FROM subscription_payments p
      JOIN subscriptions s ON s.id = p.subscription_id
      WHERE s.billing_scope_type = 'user' AND s.billing_scope_id = $1
        AND p.status IN ('succeeded', 'partially_refunded')
        AND p.id <> $2
      `,
      [referredUserId, paymentId]
    );
    const priorPaymentCount = priorResult.rows[0].count;

    // Evaluate eligibility
    const eligibility = await eligibilityService.evaluatePayment({
      payment,
      attribution,
      priorPaymentCount,
    });

    if (!eligibility.eligible) {
      logger.debug(
        { paymentId, reason: eligibility.reason },
        'Payment not eligible for commission'
      );
      return { eligible: false, reason: eligibility.reason };
    }

    // Idempotency check
    const existing = await queries.findAccrualByPayment(paymentId, eligibility.type);
    if (existing) {
      logger.debug({ paymentId, type: eligibility.type }, 'Commission already accrued');
      return { eligible: true, accrual: existing, alreadyAccrued: true };
    }

    // Create accrual and ledger entry
    const holdUntil = new Date(Date.now() + (eligibility.holdDays || 30) * 24 * 60 * 60 * 1000);

    const accrual = await db.tx(async (tx) => {
      const created = await queries.insertAccrual(tx, {
        affiliateId: attribution.affiliate_id,
        attributionId: attribution.id,
        paymentId,
        policyVersionId: eligibility.policyVersionId,
        type: eligibility.type,
        state: 'accumulated',
        amountMinor: eligibility.commissionAmountMinor,
        currency: eligibility.currency,
        holdUntil,
      });

      if (!created) {
        // Duplicate
        return queries.findAccrualByPayment(paymentId, eligibility.type);
      }

      await ledgerService.recordAccrual({
        affiliateId: attribution.affiliate_id,
        accrualId: created.id,
        amountMinor: eligibility.commissionAmountMinor,
        currency: eligibility.currency,
      });

      await events.publish(
        tx,
        'referral.commission_accrued',
        {
          accrualId: created.id,
          affiliateId: attribution.affiliate_id,
          paymentId,
          amountMinor: eligibility.commissionAmountMinor,
          currency: eligibility.currency,
          type: eligibility.type,
        },
        {
          resourceType: 'commission_accrual',
          resourceId: created.id,
        }
      );

      // Mark attribution converted if this was the first payment
      if (priorPaymentCount === 0) {
        await attributionService.markConverted({ attributionId: attribution.id });
      }

      return created;
    });

    // Recompute wallet
    await ledgerService.recomputeWallet({
      affiliateId: attribution.affiliate_id,
      currency: eligibility.currency,
    });

    return { eligible: true, accrual };
  }

  /**
   * Handle a refund on a payment that previously generated a commission.
   * Records a reversal in the ledger.
   */
  async function handleRefund({ paymentId, refundedAmountMinor, currency, reason }) {
    const accrual = await queries.findAccrualByPayment(paymentId, 'first_payment');
    const recurring = await queries.findAccrualByPayment(paymentId, 'recurring');
    const target = accrual || recurring;
    if (!target) return null;

    // If the entire payment is refunded, reverse the entire commission.
    // For partial refunds, reverse proportionally.
    const paymentResult = await db.query(
      `SELECT amount_minor FROM subscription_payments WHERE id = $1`,
      [paymentId]
    );
    const paymentAmount = Number(paymentResult.rows[0]?.amount_minor || 0);
    const refundRatio = paymentAmount > 0 ? refundedAmountMinor / paymentAmount : 1;

    const reversalAmountMinor = Math.floor(Number(target.amount_minor) * refundRatio);

    return db.tx(async (tx) => {
      await ledgerService.recordReversal({
        affiliateId: target.affiliate_id,
        accrualId: target.id,
        amountMinor: reversalAmountMinor,
        currency: target.currency,
        reason,
      });

      await queries.updateAccrualState(target.id, 'reversed');

      await events.publish(
        tx,
        'referral.commission_reversed',
        {
          accrualId: target.id,
          affiliateId: target.affiliate_id,
          paymentId,
          amountMinor: reversalAmountMinor,
          currency: target.currency,
        },
        {
          resourceType: 'commission_accrual',
          resourceId: target.id,
        }
      );
    }).then(async () => {
      await ledgerService.recomputeWallet({
        affiliateId: target.affiliate_id,
        currency: target.currency,
      });
      return { reversed: true, amountMinor: reversalAmountMinor };
    });
  }

  async function listAccruals({ affiliateId, limit }) {
    return queries.listAccrualsForAffiliate(affiliateId, { limit });
  }

  return {
    processPaymentForCommissions,
    handleRefund,
    listAccruals,
  };
}

export default createCommissionService;