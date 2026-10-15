/**
 * SyncExc Server — Copy configuration service
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

export function createCopyConfigurationService({
  db,
  queries,
  connections,
  events,
  logger,
}) {
  async function createConfiguration({
    userId,
    workspaceId,
    providerId,
    providerPlanId,
    destinationAccounts,
    marketTypes,
    instrumentFilters,
    sizingRule,
    executionMode,
  }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');
    if (provider.moderation_state !== 'approved') {
      throw new ConflictError('Provider is not approved', 'PROVIDER_NOT_APPROVED');
    }

    if (!destinationAccounts || destinationAccounts.length === 0) {
      throw new ValidationError('At least one destination account is required');
    }

    if (!['monitor_only', 'confirm_before_execution', 'authorized_automation'].includes(executionMode)) {
      throw new ValidationError('Invalid execution mode');
    }

    return db.tx(async (tx) => {
      const config = await queries.insertCopyConfiguration(tx, {
        workspaceId,
        providerId,
        providerPlanId,
        sizingRule,
        instrumentFilters,
        marketTypes,
        executionMode,
      });

      // Insert destinations
      for (const dest of destinationAccounts) {
        await queries.insertCopyDestination(tx, {
          configId: config.id,
          connectionId: dest.connectionId,
          accountId: dest.accountId,
        });
      }

      // Snapshot version 1
      await queries.insertCopyConfigurationVersion(tx, {
        configId: config.id,
        version: 1,
        snapshot: config,
      });

      // Grant permission (explicit user authorization)
      await queries.insertCopyPermissionGrant(tx, {
        configId: config.id,
        grantedBy: userId,
        scope: { executionMode },
      });

      await events.publish(
        tx,
        'marketplace.copy_config_created',
        { configId: config.id, providerId, executionMode },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'copy_configuration',
          resourceId: config.id,
        }
      );

      return config;
    });
  }

  async function activate({ userId, workspaceId, configId }) {
    const config = await queries.findCopyConfigurationById(configId);
    if (!config || config.workspace_id !== workspaceId) throw new NotFoundError('Copy configuration');
    if (config.status === 'active') return config;

    return db.tx(async (tx) => {
      const updated = await queries.updateCopyConfiguration(configId, { status: 'active' });

      await events.publish(
        tx,
        'marketplace.copy_config_activated',
        { configId, providerId: config.provider_id },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'copy_configuration',
          resourceId: configId,
        }
      );

      return updated;
    });
  }

  async function pause({ userId, workspaceId, configId }) {
    const config = await queries.findCopyConfigurationById(configId);
    if (!config || config.workspace_id !== workspaceId) throw new NotFoundError('Copy configuration');

    return db.tx(async (tx) => {
      const updated = await queries.updateCopyConfiguration(configId, { status: 'paused' });
      return updated;
    });
  }

  async function revoke({ userId, workspaceId, configId }) {
    const config = await queries.findCopyConfigurationById(configId);
    if (!config || config.workspace_id !== workspaceId) throw new NotFoundError('Copy configuration');

    return db.tx(async (tx) => {
      const updated = await queries.updateCopyConfiguration(configId, { status: 'revoked' });

      await events.publish(
        tx,
        'marketplace.copy_config_revoked',
        { configId },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'copy_configuration',
          resourceId: configId,
        }
      );

      return updated;
    });
  }

  async function listConfigurations({ workspaceId, status }) {
    return queries.listCopyConfigurationsForWorkspace(workspaceId, { status });
  }

  async function getConfiguration({ configId, workspaceId }) {
    const config = await queries.findCopyConfigurationById(configId);
    if (!config || config.workspace_id !== workspaceId) throw new NotFoundError('Copy configuration');
    const destinations = await queries.listCopyDestinations(configId);
    return { config, destinations };
  }

  return {
    createConfiguration,
    activate,
    pause,
    revoke,
    listConfigurations,
    getConfiguration,
  };
}

export default createCopyConfigurationService;