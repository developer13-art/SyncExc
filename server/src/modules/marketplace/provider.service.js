/**
 * SyncExc Server — Provider service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createProviderService({ db, queries, events, logger }) {
  async function createProvider({
    userId,
    handle,
    displayName,
    accountType,
    biography,
    methodology,
    supportedMarkets,
    supportedLanguages,
  }) {
    const existingHandle = await queries.findProviderByHandle(handle);
    if (existingHandle) throw new ConflictError('Handle is already taken', 'HANDLE_TAKEN');

    const existingUser = await queries.findProviderByUserId(userId);
    if (existingUser) throw new ConflictError('User already has a provider profile', 'PROVIDER_EXISTS');

    return db.tx(async (tx) => {
      const provider = await queries.insertProvider(tx, {
        userId,
        handle,
        displayName,
        accountType,
        biography,
        methodology,
        supportedMarkets,
        supportedLanguages,
      });

      // Snapshot version 1
      await queries.insertProviderProfileVersion(tx, {
        providerId: provider.id,
        version: 1,
        snapshot: provider,
      });

      await events.publish(
        tx,
        'marketplace.provider_created',
        { providerId: provider.id, handle },
        {
          actorId: userId,
          resourceType: 'marketplace_provider',
          resourceId: provider.id,
        }
      );

      return provider;
    });
  }

  async function getProvider(providerId) {
    return queries.findProviderById(providerId);
  }

  async function getProviderForUser(userId) {
    return queries.findProviderByUserId(userId);
  }

  async function getProviderByHandle(handle) {
    return queries.findProviderByHandle(handle);
  }

  async function listProviders({ moderationState, limit, cursor, search, markets }) {
    return queries.listProviders({ moderationState, limit, cursor, search, markets });
  }

  async function updateProvider({ userId, providerId, updates }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');
    if (provider.user_id !== userId) throw new NotFoundError('Provider');
    if (provider.moderation_state === 'suspended') {
      throw new ConflictError('Provider is suspended', 'PROVIDER_SUSPENDED');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateProvider(providerId, updates);

      await queries.insertProviderProfileVersion(tx, {
        providerId,
        version: updated.current_version + 1,
        snapshot: updated,
      });

      return updated;
    });
  }

  return {
    createProvider,
    getProvider,
    getProviderForUser,
    getProviderByHandle,
    listProviders,
    updateProvider,
  };
}

export default createProviderService;