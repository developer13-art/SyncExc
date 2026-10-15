/**
 * SyncExc Server — Source registry service
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

export function createSourceRegistryService({ db, queries, events, audit, logger }) {
  async function registerSource({
    userId,
    workspaceId,
    type,
    name,
    identifier,
    url,
    providerName,
    marketCoverage,
    exchangeCoverage,
    assetCoverage,
    primaryLanguage,
    categories,
    accessMethod,
  }) {
    if (!name || !type || !identifier) {
      throw new ValidationError('name, type, and identifier are required');
    }

    const validTypes = ['telegram', 'discord', 'whatsapp', 'webhook', 'website', 'rest_api', 'email'];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`Unsupported source type: ${type}`);
    }

    const source = await db.tx(async (tx) => {
      const created = await queries.insertSource(tx, {
        workspaceId,
        ownerId: userId,
        type,
        name,
        url,
        providerName,
      });

      // Identifier
      await queries.insertIdentifier(tx, {
        sourceId: created.id,
        identifierType: `${type}_identifier`,
        value: identifier,
        canonical: true,
      });

      // Snapshot version 1
      await queries.insertSourceVersion(tx, {
        sourceId: created.id,
        version: 1,
        snapshot: created,
      });

      // Categories
      if (categories && categories.length > 0) {
        for (const code of categories) {
          const cat = await queries.findCategoryByCode('primary', code);
          if (cat) {
            await queries.assignCategory(tx, {
              sourceId: created.id,
              categoryId: cat.id,
              provenance: 'user_provided',
            });
          }
        }
      }

      // Connection
      await queries.insertSourceConnection(tx, {
        sourceId: created.id,
        adapterType: type,
        status: 'pending',
      });

      // Audit
      await queries.insertAuditEvent(tx, {
        sourceId: created.id,
        actorId: userId,
        action: 'source.registered',
        resourceType: 'signal_source',
        resourceId: created.id,
        after: { name, type },
      });

      // Emit
      await events.publish(
        tx,
        'source.registered',
        { sourceId: created.id, type, name },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'signal_source',
          resourceId: created.id,
        }
      );

      return created;
    });

    return source;
  }

  async function getSource(sourceId) {
    return queries.findSourceById(sourceId);
  }

  async function getSourceForWorkspace({ sourceId, workspaceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source) throw new NotFoundError('Source');
    if (source.workspace_id !== workspaceId) {
      // Check if it's shared with this workspace
      const shares = await queries.listSharesForSource(sourceId);
      const hasAccess = shares.some((s) => s.shared_with_workspace_id === workspaceId);
      if (!hasAccess) throw new NotFoundError('Source');
    }
    return source;
  }

  async function listSources({ workspaceId, status, type }) {
    return queries.listSourcesForWorkspace(workspaceId, { status, type });
  }

  async function getActiveSourcesForWorkspace(workspaceId) {
    return queries.listActiveSourcesForWorkspace(workspaceId);
  }

  async function updateSource({ userId, workspaceId, sourceId, updates }) {
    await getSourceForWorkspace({ sourceId, workspaceId });

    return db.tx(async (tx) => {
      const updated = await queries.updateSource(sourceId, updates);

      await queries.insertSourceVersion(tx, {
        sourceId,
        version: updated.current_version + 1,
        snapshot: updated,
      });

      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: 'source.updated',
        resourceType: 'signal_source',
        resourceId: sourceId,
        after: updates,
      });

      return updated;
    });
  }

  async function activateSource({ userId, workspaceId, sourceId }) {
    const source = await getSourceForWorkspace({ sourceId, workspaceId });

    if (!['approved', 'pending_validation', 'paused'].includes(source.status)) {
      throw new ConflictError(
        `Source cannot be activated from status ${source.status}`,
        'INVALID_STATUS'
      );
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateSourceStatus(sourceId, 'active');

      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: 'source.activated',
        resourceType: 'signal_source',
        resourceId: sourceId,
      });

      await events.publish(
        tx,
        'source.activated',
        { sourceId },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'signal_source',
          resourceId: sourceId,
        }
      );

      return updated;
    });
  }

  async function pauseSource({ userId, workspaceId, sourceId, reason }) {
    const source = await getSourceForWorkspace({ sourceId, workspaceId });
    if (source.status !== 'active') {
      throw new ConflictError('Source is not active', 'NOT_ACTIVE');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateSourceStatus(sourceId, 'paused');

      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: 'source.paused',
        resourceType: 'signal_source',
        resourceId: sourceId,
        after: { reason },
      });

      await events.publish(
        tx,
        'source.paused',
        { sourceId, reason },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'signal_source',
          resourceId: sourceId,
        }
      );

      return updated;
    });
  }

  async function archiveSource({ userId, workspaceId, sourceId }) {
    await getSourceForWorkspace({ sourceId, workspaceId });

    return db.tx(async (tx) => {
      const updated = await queries.updateSourceStatus(sourceId, 'archived', new Date());

      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: 'source.archived',
        resourceType: 'signal_source',
        resourceId: sourceId,
      });

      return updated;
    });
  }

  return {
    registerSource,
    getSource,
    getSourceForWorkspace,
    listSources,
    getActiveSourcesForWorkspace,
    updateSource,
    activateSource,
    pauseSource,
    archiveSource,
  };
}

export default createSourceRegistryService;