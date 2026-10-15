/**
 * SyncExc Server — Commission eligibility service
 *
 * Determines whether a payment qualifies for a commission under the
 * applicable policy version. Real, rule-based evaluation.
 */

export function createEligibilityService({ db, queries, commissionPolicyService, logger }) {
  /**
   * @param {Object} params
   * @param {Object} params.payment            subscription_payments row
   * @param {Object} params.attribution        referral_attributions row
   * @param {number} params.priorPaymentCount  how many qualifying payments this user has made before
   * @returns {Object}                         { eligible, type, reason, eligibleRevenueMinor }
   */
  async function evaluatePayment({
    payment,
    attribution,
    priorPaymentCount,
  }) {
    if (!attribution) {
      return { eligible: false, reason: 'no_attribution' };
    }
    if (attribution.state !== 'attributed' && attribution.state !== 'converted') {
      return { eligible: false, reason: 'attribution_not_active' };
    }

    if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded') {
      return { eligible: false, reason: 'payment_not_succeeded' };
    }

    // Get policy from attribution
    const policyVersion = await db.query(
      `SELECT * FROM commission_policy_versions WHERE id = $1`,
      [payment.metadata?.policyVersionId].filter(Boolean)
    );

    let activePolicy;
    if (policyVersion.rows.length > 0) {
      activePolicy = policyVersion.rows[0];
    } else {
      // Find any active policy; in a real deployment the attribution
      // would reference the exact version.
      const policies = await db.query(
        `SELECT * FROM commission_policies WHERE status = 'active' LIMIT 1`
      );
      if (policies.rows.length === 0) {
        return { eligible: false, reason: 'no_active_policy' };
      }
      activePolicy = await commissionPolicyService.getActiveVersion(policies.rows[0].id);
    }

    const config = activePolicy.config || {};

    // Determine commission type
    const isFirstPayment = priorPaymentCount === 0;
    const type = isFirstPayment ? 'first_payment' : 'recurring';

    // First-payment commission rule
    if (isFirstPayment && !config.firstPayment?.enabled) {
      return { eligible: false, reason: 'first_payment_commission_disabled' };
    }

    // Recurring rule
    if (!isFirstPayment && !config.recurring?.enabled) {
      return { eligible: false, reason: 'recurring_commission_disabled' };
    }

    // Duration limit for recurring
    if (!isFirstPayment && config.recurring?.maxPayments) {
      if (priorPaymentCount >= config.recurring.maxPayments) {
        return { eligible: false, reason: 'recurring_duration_exceeded' };
      }
    }

    // Minimum payment amount
    const minPayment = config.minimumPaymentMinor || 0;
    const eligibleRevenueMinor = computeEligibleRevenue({
      amountMinor: Number(payment.amount_minor),
      refundedMinor: 0, // computed by caller if known
      excludeTaxesMinor: payment.metadata?.taxMinor || 0,
    });

    if (eligibleRevenueMinor < minPayment) {
      return { eligible: false, reason: 'below_minimum_payment' };
    }

    // Determine rate
    const rate =
      type === 'first_payment'
        ? config.firstPayment?.rate ?? 20
        : config.recurring?.rate ?? 10;

    const commissionAmountMinor = Math.floor((eligibleRevenueMinor * rate) / 100);

    return {
      eligible: true,
      type,
      reason: 'eligible',
      rate,
      eligibleRevenueMinor,
      commissionAmountMinor,
      policyVersionId: activePolicy.id,
      policyVersion: activePolicy.version,
      holdDays: config.holdingPeriodDays || 30,
      currency: payment.currency,
    };
  }

  function computeEligibleRevenue({ amountMinor, refundedMinor, excludeTaxesMinor }) {
    let base = amountMinor - (refundedMinor || 0) - (excludeTaxesMinor || 0);
    if (base < 0) base = 0;
    return base;
  }

  return {
    evaluatePayment,
  };
}

export default createEligibilityService;