/**
 * SyncExc Server — Source health service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createHealthService({ db, queries, adapterRegistry, events, logger }) {
  async function checkSource({ sourceId, userId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source) throw new NotFoundError('Source');

    const connection = await queries.findSourceConnection(sourceId);
    const adapter = adapterRegistry.get(source.type);
    if (!adapter) return;

    let state = 'healthy';
    let lastEventAt = null;
    let errorCount = 0;
    let metadata = {};

    try {
      const result = await adapter.testConnection({ source, connection });
      if (!result.reachable) {
        state = 'disconnected';
      } else if (!result.hasContent) {
        // Check staleness
        const ageMs = result.lastEventAt ? Date.now() - new Date(result.lastEventAt).getTime() : null;
        if (ageMs && ageMs > 24 * 60 * 60 * 1000) {
          state = 'stale';
        } else {
          state = 'degraded';
        }
      }
      lastEventAt = result.lastEventAt;
      metadata = result.summary || {};
    } catch (err) {
      state = err.code === 'AUTH_FAILED' ? 'authorization_required' : 'unavailable';
      errorCount = 1;
      logger.warn({ err, sourceId }, 'Source health check failed');
    }

    const previous = await queries.getLatestHealthSnapshot(sourceId);

    await db.tx(async (tx) => {
      await queries.insertHealthSnapshot(tx, {
        sourceId,
        state,
        lastEventAt,
        errorCount,
        metadata,
      });

      if (state !== 'healthy') {
        await queries.insertAlert(tx, {
          sourceId,
          category: state,
          severity: state === 'disconnected' ? 'high' : 'warning',
          message: `Source health changed to ${state}`,
        });
      }

      await queries.updateSource(sourceId, { healthState: state });
    });

    // Emit only when state changes
    if (!previous || previous.state !== state) {
      await events.publish(
        db,
        'source.health_changed',
        { sourceId, previousState: previous?.state, newState: state },
        {
          actorId: userId || null,
          workspaceId: source.workspace_id,
          resourceType: 'signal_source',
          resourceId: sourceId,
        }
      );
    }

    return { state, lastEventAt };
  }

  async function checkAllSources() {
    const sources = await queries.listSourcesForHealthCheck();
    for (const source of sources) {
      await checkSource({ sourceId: source.id });
    }
  }

  async function getHealth({ sourceId, workspaceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Source');
    const snapshot = await queries.getLatestHealthSnapshot(sourceId);
    const alerts = await queries.listOpenAlerts(sourceId);
    return { snapshot, alerts };
  }

  return {
    checkSource,
    checkAllSources,
    getHealth,
  };
}

export default createHealthService;