/**
 * SyncExc Server — Provider service
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

export function createProviderService({ db, queries, events, logger }) {
  async function createProvider({
    userId,
    workspaceId,
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

    const workspaceResult = await db.query(
      `
      SELECT w.type, w.owner_id, m.role
      FROM workspaces w
      JOIN workspace_memberships m ON m.workspace_id = w.id
      WHERE w.id = $1 AND m.user_id = $2 AND m.status = 'active' AND w.status = 'active'
      `,
      [workspaceId, userId]
    );
    const workspace = workspaceResult.rows[0];
    if (!workspace || workspace.type !== 'trader') {
      throw new AuthorizationError('Create a Trader workspace before setting up a public profile', 'TRADER_WORKSPACE_REQUIRED');
    }
    if (!['owner', 'administrator'].includes(workspace.role)) {
      throw new AuthorizationError('Only a Trader workspace owner or administrator can create its profile');
    }

    const existingWorkspace = await queries.findProviderByWorkspaceId(workspaceId);
    if (existingWorkspace) throw new ConflictError('This Trader workspace already has a provider profile', 'PROVIDER_EXISTS');

    return db.tx(async (tx) => {
      const provider = await queries.insertProvider(tx, {
        userId,
        workspaceId,
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
          workspaceId,
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

  async function getProviderForUser(userId, workspaceId) {
    if (!workspaceId) return queries.findProviderByUserId(userId);
    return queries.findProviderByWorkspaceId(workspaceId);
  }

  async function getProviderByHandle(handle) {
    return queries.findProviderByHandle(handle);
  }

  async function listProviders({ moderationState, limit, cursor, search, markets }) {
    return queries.listProviders({ moderationState, limit, cursor, search, markets });
  }

  async function updateProvider({ userId, workspaceId, providerId, updates }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');
    if (provider.user_id !== userId || provider.workspace_id !== workspaceId) throw new NotFoundError('Provider');
    if (updates.visibility === 'public' &&
        (provider.moderation_state !== 'approved' || !provider.biography || !provider.methodology)) {
      throw new ConflictError('An approved profile with a biography and methodology is required before publishing', 'PROFILE_NOT_READY');
    }
    if (provider.moderation_state === 'suspended') {
      throw new ConflictError('Provider is suspended', 'PROVIDER_SUSPENDED');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateProvider(providerId, updates, tx);

      await queries.insertProviderProfileVersion(tx, {
        providerId,
        version: provider.current_version + 1,
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