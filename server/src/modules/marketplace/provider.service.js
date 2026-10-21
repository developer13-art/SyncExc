/**
 * SyncExc Server — Provider service
 */

import {
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from '../../lib/errors.js';

export function createProviderService({ db, queries, events, profileImages, logger }) {
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

  async function getProviderDashboard({ userId, workspaceId }) {
    const provider = await getProviderForUser(userId, workspaceId);
    if (!provider) return null;
    return {
      provider,
      stats: await queries.getProviderDashboard(provider.id),
      recentSignals: (await queries.listPublishedSignals({
        providerId: provider.id,
        publicOnly: true,
        limit: 5,
      })).rows,
    };
  }

  async function listProviderSubscribers({ userId, workspaceId }) {
    if (!await getProviderForUser(userId, workspaceId)) return null;
    const provider = await requireProviderManager(userId, workspaceId);
    return queries.listProviderSubscribers(provider.id);
  }

  async function listManagedProviderPlans({ userId, workspaceId }) {
    if (!await getProviderForUser(userId, workspaceId)) return [];
    const provider = await requireProviderManager(userId, workspaceId);
    return queries.listManagedProviderPlans(provider.id);
  }

  async function listProviderPlans(providerId) {
    return queries.listProviderPlans(providerId);
  }

  async function createProviderPlan({
    userId,
    workspaceId,
    name,
    pricing,
    entitlements,
  }) {
    const provider = await requireProviderManager(userId, workspaceId);
    return db.tx(async (tx) => {
      const plan = await queries.insertProviderPlan(tx, {
        providerId: provider.id,
        name,
        pricing,
        entitlements,
      });
      await queries.insertProviderPlanVersion(tx, plan);
      return plan;
    });
  }

  async function updateProviderPlan({ userId, workspaceId, planId, status }) {
    const provider = await requireProviderManager(userId, workspaceId);
    const plan = await queries.findProviderPlanById(planId);
    if (!plan || plan.provider_id !== provider.id) throw new NotFoundError('Provider plan');

    const allowed = plan.status === 'draft'
      ? ['active', 'archived']
      : plan.status === 'active'
        ? ['retired']
        : plan.status === 'retired'
          ? ['active', 'archived']
          : [];
    if (!allowed.includes(status)) {
      throw new ConflictError('Provider plan cannot transition to that status', 'INVALID_PLAN_STATE');
    }
    if (status === 'active') {
      if (provider.moderation_state !== 'approved' || provider.visibility !== 'public') {
        throw new ConflictError('An approved, public profile is required to activate a plan', 'PROFILE_NOT_PUBLISHED');
      }
      if (Number(plan.pricing?.amountMinor) !== 0) {
        throw new ConflictError(
          'Paid subscription plans cannot be activated until marketplace billing is available',
          'PAID_PLANS_UNAVAILABLE',
        );
      }
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateProviderPlanStatus(provider.id, planId, status, tx);
      if (!updated) throw new NotFoundError('Provider plan');
      await queries.insertProviderPlanVersion(tx, updated);
      return updated;
    });
  }

  async function requireProviderManager(userId, workspaceId) {
    const result = await db.query(
      `
      SELECT w.type, m.role
      FROM workspaces w
      JOIN workspace_memberships m ON m.workspace_id = w.id
      WHERE w.id = $1 AND m.user_id = $2 AND m.status = 'active' AND w.status = 'active'
      `,
      [workspaceId, userId],
    );
    if (!result.rows[0] || result.rows[0].type !== 'trader') {
      throw new AuthorizationError('An active Trader workspace is required', 'TRADER_WORKSPACE_REQUIRED');
    }
    if (!['owner', 'administrator'].includes(result.rows[0].role)) {
      throw new AuthorizationError('Only Trader workspace owners and administrators can manage plans');
    }
    const provider = await queries.findProviderByWorkspaceId(workspaceId);
    if (!provider) throw new NotFoundError('Trader profile');
    return provider;
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

  async function updateCoverImage({ userId, workspaceId, providerId, file }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider || provider.user_id !== userId || provider.workspace_id !== workspaceId) {
      throw new NotFoundError('Provider');
    }
    const stored = await profileImages.upload(file);
    let updated;
    try {
      updated = await updateProvider({
        userId,
        workspaceId,
        providerId,
        updates: { coverImageUrl: stored.url },
      });
    } catch (error) {
      try {
        await profileImages.remove(stored.url);
      } catch (cleanupError) {
        logger.error({ cleanupError, providerId }, 'Could not clean up failed trader cover upload');
      }
      throw error;
    }
    if (provider.cover_image_url && provider.cover_image_url !== stored.url) {
      try {
        await profileImages.remove(provider.cover_image_url);
      } catch (error) {
        logger.error({ error, providerId }, 'Could not remove replaced trader cover image');
      }
    }
    return updated;
  }

  return {
    createProvider,
    getProvider,
    getProviderForUser,
    getProviderByHandle,
    listProviders,
    getProviderDashboard,
    listProviderSubscribers,
    listManagedProviderPlans,
    listProviderPlans,
    createProviderPlan,
    updateProviderPlan,
    updateProvider,
    updateCoverImage,
  };
}

export default createProviderService;