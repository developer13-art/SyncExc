/**
 * SyncExc Server — Account service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAccountService({ db, queries, logger }) {
  async function createAccount({ environmentId, label, exchangeCode, accountType }) {
    return db.tx(async (tx) => {
      return queries.insertAccount(tx, {
        environmentId,
        label,
        exchangeCode,
        accountType,
      });
    });
  }

  async function listAccounts({ environmentId }) {
    return queries.listAccountsForEnvironment(environmentId);
  }

  async function getBalances({ accountId }) {
    const account = await queries.findAccountById(accountId);
    if (!account) throw new NotFoundError('Account');
    const balances = await queries.listBalances(accountId);
    return balances.map((b) => ({
      asset: b.asset,
      free: b.free,
      used: b.used,
      total: b.total,
    }));
  }

  async function getLedger({ accountId, limit }) {
    return queries.listLedgerEntries(accountId, { limit });
  }

  return {
    createAccount,
    listAccounts,
    getBalances,
    getLedger,
  };
}

export default createAccountService;