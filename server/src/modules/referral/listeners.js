/**
 * SyncExc Server — Referral event listeners
 */

export function createReferralListeners({ events, commissionService, logger }) {
  events.subscribe(
    'billing.payment_succeeded',
    async (envelope) => {
      const { paymentId } = envelope.payload || {};
      if (!paymentId) return;
      try {
        await commissionService.processPaymentForCommissions(paymentId);
      } catch (err) {
        logger.error({ err, paymentId }, 'Commission processing failed');
      }
    },
    { name: 'referral:commission-on-payment' }
  );

  events.subscribe(
    'billing.refund_completed',
    async (envelope) => {
      const { paymentId, amountMinor, currency, reason } = envelope.payload || {};
      if (!paymentId) return;
      try {
        await commissionService.handleRefund({
          paymentId,
          refundedAmountMinor: amountMinor,
          currency,
          reason: reason || 'refund',
        });
      } catch (err) {
        logger.error({ err, paymentId }, 'Commission reversal failed');
      }
    },
    { name: 'referral:reversal-on-refund' }
  );

  logger.debug('Referral event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createReferralListeners;