/**
 * SyncExc Server — Commission ledger service
 */

export function createLedgerService({ db, queries, logger }) {
  async function recordAccrual({ affiliateId, accrualId, amountMinor, currency }) {
    return db.tx(async (tx) => {
      return queries.insertLedgerEntry(tx, {
        affiliateId,
        accrualId,
        entryType: 'commission_accumulated',
        amountMinor,
        currency,
        sourceType: 'commission_accrual',
        sourceId: accrualId,
      });
    });
  }

  async function recordRelease({ affiliateId, accrualId, amountMinor, currency }) {
    return db.tx(async (tx) => {
      return queries.insertLedgerEntry(tx, {
        affiliateId,
        accrualId,
        entryType: 'commission_released',
        amountMinor,
        currency,
        sourceType: 'commission_accrual',
        sourceId: accrualId,
      });
    });
  }

  async function recordReversal({ affiliateId, accrualId, amountMinor, currency, reason }) {
    return db.tx(async (tx) => {
      return queries.insertLedgerEntry(tx, {
        affiliateId,
        accrualId,
        entryType: 'commission_reversed',
        amountMinor: -Math.abs(amountMinor),
        currency,
        sourceType: 'commission_accrual',
        sourceId: accrualId,
        metadata: { reason },
      });
    });
  }

  async function recordAdjustment({ affiliateId, accrualId, amountMinor, currency, reason }) {
    return db.tx(async (tx) => {
      return queries.insertLedgerEntry(tx, {
        affiliateId,
        accrualId,
        entryType: 'commission_adjusted',
        amountMinor,
        currency,
        sourceType: 'commission_accrual',
        sourceId: accrualId,
        metadata: { reason },
      });
    });
  }

  async function recordPayoutReserve({ affiliateId, payoutId, amountMinor, currency }) {
    return db.tx(async (tx) => {
      return queries.insertLedgerEntry(tx, {
        affiliateId,
        accrualId: null,
        entryType: 'payout_reserved',
        amountMinor: -Math.abs(amountMinor),
        currency,
        sourceType: 'payout',
        sourceId: payoutId,
      });
    });
  }

  async function recordPayoutCompleted({ affiliateId, payoutId, amountMinor, currency }) {
    return db.tx(async (tx) => {
      return queries.insertLedgerEntry(tx, {
        affiliateId,
        accrualId: null,
        entryType: 'payout_completed',
        amountMinor: -Math.abs(amountMinor),
        currency,
        sourceType: 'payout',
        sourceId: payoutId,
      });
    });
  }

  async function recordPayoutReversed({ affiliateId, payoutId, amountMinor, currency, reason }) {
    return db.tx(async (tx) => {
      return queries.insertLedgerEntry(tx, {
        affiliateId,
        accrualId: null,
        entryType: 'payout_reversed',
        amountMinor: Math.abs(amountMinor),
        currency,
        sourceType: 'payout',
        sourceId: payoutId,
        metadata: { reason },
      });
    });
  }

  /**
   * Recompute the affiliate's balance from the ledger and persist a
   * wallet snapshot. Called after every mutation.
   */
  async function recomputeWallet({ affiliateId, currency = 'USD' }) {
    const totals = await queries.sumLedgerByType(affiliateId, currency);

    const accumulated = Number(totals.commission_accumulated || 0);
    const released = Number(totals.commission_released || 0);
    const adjusted = Number(totals.commission_adjusted || 0);
    const reversed = Number(totals.commission_reversed || 0);
    const reserved = Math.abs(Number(totals.payout_reserved || 0));
    const paid = Math.abs(Number(totals.payout_completed || 0));
    const payoutReversed = Number(totals.payout_reversed || 0);

    const pending = accumulated + adjusted + reversed;
    const available = pending - reserved;
    const paidTotal = paid - payoutReversed;

    return db.tx(async (tx) => {
      return queries.upsertWallet(tx, {
        affiliateId,
        currency,
        availableMinor: Math.max(0, available),
        pendingMinor: pending,
        heldMinor: 0,
        paidMinor: paidTotal,
      });
    });
  }

  async function listEntries({ affiliateId, limit }) {
    return queries.listLedgerEntries(affiliateId, { limit });
  }

  async function getBalance({ affiliateId, currency }) {
    return queries.getWallet(affiliateId, currency);
  }

  return {
    recordAccrual,
    recordRelease,
    recordReversal,
    recordAdjustment,
    recordPayoutReserve,
    recordPayoutCompleted,
    recordPayoutReversed,
    recomputeWallet,
    listEntries,
    getBalance,
  };
}

export default createLedgerService;