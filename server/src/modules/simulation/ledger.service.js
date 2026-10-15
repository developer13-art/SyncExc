/**
 * SyncExc Server — Ledger service
 */

export function createLedgerService({ db, queries, logger }) {
  async function deposit({ accountId, asset, amount, sourceType = 'manual' }) {
    return db.tx(async (tx) => {
      const balance = await queries.getBalance(accountId, asset);
      const current = balance ? Number(balance.total) : 0;
      const next = current + Number(amount);

      await queries.upsertBalance(tx, {
        accountId,
        asset,
        free: next.toFixed(8),
        used: '0',
        total: next.toFixed(8),
      });

      return queries.insertLedgerEntry(tx, {
        accountId,
        asset,
        amount: String(amount),
        entryType: 'deposit',
        sourceType,
      });
    });
  }

  async function withdraw({ accountId, asset, amount, sourceType = 'manual' }) {
    return db.tx(async (tx) => {
      const balance = await queries.getBalance(accountId, asset);
      const current = balance ? Number(balance.total) : 0;
      const next = current - Number(amount);

      await queries.upsertBalance(tx, {
        accountId,
        asset,
        free: next.toFixed(8),
        used: '0',
        total: next.toFixed(8),
      });

      return queries.insertLedgerEntry(tx, {
        accountId,
        asset,
        amount: String(-amount),
        entryType: 'withdrawal',
        sourceType,
      });
    });
  }

  async function listEntries({ accountId, limit }) {
    return queries.listLedgerEntries(accountId, { limit });
  }

  return {
    deposit,
    withdraw,
    listEntries,
  };
}

export default createLedgerService;