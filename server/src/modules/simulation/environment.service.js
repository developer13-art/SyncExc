/**
 * SyncExc Server — Environment service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createEnvironmentService({ db, queries, events, logger }) {
  async function createEnvironment({
    userId,
    workspaceId,
    name,
    type,
    initialBalances,
    exchanges,
  }) {
    return db.tx(async (tx) => {
      const environment = await queries.insertEnvironment(tx, {
        workspaceId,
        name,
        type,
        settings: {
          startingBalances: initialBalances,
          exchanges: exchanges || [],
        },
        createdBy: userId,
      });

      // Snapshot version 1
      await queries.insertEnvironmentVersion(tx, {
        environmentId: environment.id,
        version: 1,
        config: { initialBalances, exchanges },
      });

      // Create the default simulation account
      const account = await queries.insertAccount(tx, {
        environmentId: environment.id,
        label: 'Primary',
        exchangeCode: exchanges?.[0] || null,
        accountType: 'spot',
      });

      // Initialize balances
      for (const balance of initialBalances || []) {
        await queries.upsertBalance(tx, {
          accountId: account.id,
          asset: balance.asset,
          free: String(balance.amount),
          used: '0',
          total: String(balance.amount),
        });

        await queries.insertLedgerEntry(tx, {
          accountId: account.id,
          asset: balance.asset,
          amount: String(balance.amount),
          entryType: 'initial_deposit',
          sourceType: 'environment_creation',
        });
      }

      await events.publish(
        tx,
        'simulation.environment_created',
        { environmentId: environment.id, type },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'simulation_environment',
          resourceId: environment.id,
        }
      );

      return environment;
    });
  }

  async function getEnvironment({ environmentId, workspaceId }) {
    const env = await queries.findEnvironmentById(environmentId);
    if (!env || env.workspace_id !== workspaceId) throw new NotFoundError('Environment');
    return env;
  }

  async function getEnvironmentById(environmentId) {
    return queries.findEnvironmentById(environmentId);
  }

  async function listEnvironments({ workspaceId, type }) {
    return queries.listEnvironmentsForWorkspace(workspaceId, { type });
  }

  async function updateEnvironment({ userId, workspaceId, environmentId, updates }) {
    const env = await queries.findEnvironmentById(environmentId);
    if (!env || env.workspace_id !== workspaceId) throw new NotFoundError('Environment');

    return db.tx(async (tx) => {
      return queries.updateEnvironment(environmentId, updates);
    });
  }

  async function archiveEnvironment({ userId, workspaceId, environmentId }) {
    const env = await queries.findEnvironmentById(environmentId);
    if (!env || env.workspace_id !== workspaceId) throw new NotFoundError('Environment');
    return queries.updateEnvironment(environmentId, { state: 'archived' });
  }

  return {
    createEnvironment,
    getEnvironment,
    getEnvironmentById,
    listEnvironments,
    updateEnvironment,
    archiveEnvironment,
  };
}

export default createEnvironmentService;