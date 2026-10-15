/**
 * SyncExc Server — Payout service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createPayoutService({
  db,
  queries,
  ledgerService,
  providerRegistry,
  fraudService,
  events,
  logger,
}) {
  /**
   * Create a payout request. Reserves the amount in the ledger.
   */
  async function requestPayout({
    userId,
    affiliateId,
    methodId,
    amountMinor,
    currency,
  }) {
    if (amountMinor <= 0) {
      throw new ConflictError('Payout amount must be positive', 'INVALID_AMOUNT');
    }

    // Verify method belongs to affiliate
    const method = await queries.findPayoutMethodById(methodId);
    if (!method || method.affiliate_id !== affiliateId) throw new NotFoundError('Payout method');
    if (method.status !== 'active') throw new ConflictError('Payout method is disabled', 'METHOD_DISABLED');

    // Verify affiliate balance
    const wallet = await ledgerService.getBalance({ affiliateId, currency });
    if (!wallet || Number(wallet.available_minor) < amountMinor) {
      throw new ConflictError('Insufficient available balance', 'INSUFFICIENT_BALANCE');
    }

    // Fraud check
    const fraudResult = await fraudService.screenPayoutRequest({
      affiliateId,
      amountMinor,
      currency,
      methodId,
    });

    const reservationRef = `payout:${affiliateId}:${Date.now()}`;

    const payout = await db.tx(async (tx) => {
      const created = await queries.insertPayoutRequest(tx, {
        affiliateId,
        methodId,
        amountMinor,
        currency,
        reservationRef,
      });

      await queries.insertPayoutEvent(tx, {
        payoutId: created.id,
        eventType: 'requested',
        actorId: userId,
        metadata: { amountMinor, currency },
      });

      await ledgerService.recordPayoutReserve({
        affiliateId,
        payoutId: created.id,
        amountMinor,
        currency,
      });

      await events.publish(
        tx,
        'referral.payout_requested',
        {
          payoutId: created.id,
          affiliateId,
          amountMinor,
          currency,
        },
        {
          actorId: userId,
          resourceType: 'affiliate_payout',
          resourceId: created.id,
        }
      );

      // If fraud screen flags review, leave status at requested but add a marker
      if (fraudResult.requiresReview) {
        await queries.insertPayoutEvent(tx, {
          payoutId: created.id,
          eventType: 'fraud_review_required',
          metadata: { reason: fraudResult.reason },
        });
      }

      return created;
    });

    // Recompute wallet to reflect reservation
    await ledgerService.recomputeWallet({ affiliateId, currency });

    // If no review required, dispatch immediately
    if (!fraudResult.requiresReview) {
      processPayoutRequest(payout.id).catch((err) => {
        logger.error({ err, payoutId: payout.id }, 'Payout processing failed');
      });
    }

    return payout;
  }

  /**
   * Execute a payout through the provider adapter.
   * Called by the job runner or immediately after requestPayout.
   */
  async function processPayoutRequest(payoutId) {
    const payout = await queries.findPayoutRequestById(payoutId);
    if (!payout) throw new NotFoundError('Payout');

    if (!['requested', 'approved', 'pending_review'].includes(payout.status)) {
      return payout;
    }

    // Load method + provider
    const method = await queries.findPayoutMethodById(payout.method_id);
    if (!method || method.status !== 'active') {
      return failPayout(payoutId, 'method_disabled');
    }

    const provider = providerRegistry.get(method.provider);
    if (!provider) {
      return failPayout(payoutId, `provider_not_supported: ${method.provider}`);
    }

    // Mark as processing
    await queries.updatePayoutRequest(payoutId, {
      status: 'processing',
      processingAt: new Date(),
    });

    let result;
    try {
      result = await provider.createPayout({
        amountMinor: Number(payout.amount_minor),
        currency: payout.currency,
        providerToken: method.provider_token,
        reference: payout.id,
        metadata: {
          affiliateId: payout.affiliate_id,
          displaySummary: method.display_summary,
        },
      });
    } catch (err) {
      logger.error({ err, payoutId }, 'Provider payout failed');
      return failPayout(payoutId, err.message);
    }

    if (!result.ok) {
      return failPayout(payoutId, result.error || 'provider_error');
    }

    // Record provider transaction
    await db.tx(async (tx) => {
      await queries.insertPayoutProviderTransaction(tx, {
        payoutId,
        provider: method.provider,
        providerTxId: result.providerTxId,
        status: result.status || 'processing',
        rawResponse: result.raw,
      });

      await queries.insertPayoutEvent(tx, {
        payoutId,
        eventType: 'submitted_to_provider',
        metadata: { providerTxId: result.providerTxId },
      });
    });

    // If the provider already confirms completion, mark paid
    if (result.status === 'paid') {
      return completePayout(payoutId, result.providerTxId);
    }

    return queries.findPayoutRequestById(payoutId);
  }

  /**
   * Handle provider status updates (from webhooks or polling).
   */
  async function handleProviderStatusUpdate({
    payoutId,
    providerTxId,
    status,
    failureReason,
  }) {
    const payout = await queries.findPayoutRequestById(payoutId);
    if (!payout) return;

    if (status === 'paid') {
      return completePayout(payoutId, providerTxId);
    }
    if (status === 'failed' || status === 'returned') {
      return failPayout(payoutId, failureReason || status);
    }

    await db.tx(async (tx) => {
      await queries.insertPayoutEvent(tx, {
        payoutId,
        eventType: `provider_status.${status}`,
        metadata: { providerTxId, failureReason },
      });
    });
  }

  async function completePayout(payoutId, providerReference) {
    const payout = await queries.findPayoutRequestById(payoutId);
    if (!payout) return null;

    await db.tx(async (tx) => {
      await queries.updatePayoutRequest(payoutId, {
        status: 'paid',
        providerReference,
        completedAt: new Date(),
      });

      await queries.insertPayoutEvent(tx, {
        payoutId,
        eventType: 'paid',
        metadata: { providerReference },
      });

      await ledgerService.recordPayoutCompleted({
        affiliateId: payout.affiliate_id,
        payoutId,
        amountMinor: Number(payout.amount_minor),
        currency: payout.currency,
      });

      await events.publish(
        tx,
        'referral.payout_processed',
        {
          payoutId,
          affiliateId: payout.affiliate_id,
          amountMinor: Number(payout.amount_minor),
          currency: payout.currency,
        },
        {
          resourceType: 'affiliate_payout',
          resourceId: payoutId,
        }
      );
    });

    await ledgerService.recomputeWallet({
      affiliateId: payout.affiliate_id,
      currency: payout.currency,
    });

    return queries.findPayoutRequestById(payoutId);
  }

  async function failPayout(payoutId, reason) {
    const payout = await queries.findPayoutRequestById(payoutId);
    if (!payout) return null;

    await db.tx(async (tx) => {
      await queries.updatePayoutRequest(payoutId, {
        status: 'failed',
        failureReason: reason,
      });

      await queries.insertPayoutEvent(tx, {
        payoutId,
        eventType: 'failed',
        metadata: { reason },
      });

      await ledgerService.recordPayoutReversed({
        affiliateId: payout.affiliate_id,
        payoutId,
        amountMinor: Number(payout.amount_minor),
        currency: payout.currency,
        reason,
      });
    });

    await ledgerService.recomputeWallet({
      affiliateId: payout.affiliate_id,
      currency: payout.currency,
    });

    return queries.findPayoutRequestById(payoutId);
  }

  async function listPayouts({ affiliateId, limit }) {
    return queries.listPayoutsForAffiliate(affiliateId, { limit });
  }

  async function getPayout({ payoutId, affiliateId }) {
    const payout = await queries.findPayoutRequestById(payoutId);
    if (!payout || payout.affiliate_id !== affiliateId) throw new NotFoundError('Payout');
    return payout;
  }

  return {
    requestPayout,
    processPayoutRequest,
    handleProviderStatusUpdate,
    listPayouts,
    getPayout,
  };
}

export default createPayoutService;