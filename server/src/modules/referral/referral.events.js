/**
 * SyncExc Server — Referral events
 */

export const REFERRAL_EMITS = [
  'referral.affiliate_enrolled',
  'referral.attributed',
  'referral.policy_published',
  'referral.commission_accrued',
  'referral.commission_reversed',
  'referral.payout_requested',
  'referral.payout_processed',
  'referral.fraud_case_opened',
];

export const REFERRAL_CONSUMES = [
  'billing.payment_succeeded',
  'billing.refund_completed',
];

export default {
  REFERRAL_EMITS,
  REFERRAL_CONSUMES,
};