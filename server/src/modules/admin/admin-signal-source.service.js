/**
 * SyncExc Server — Admin signal source service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAdminSignalSourceService({ db, queries, sources, audit, logger }) {
  async function listSources({ status, type, limit = 100 } = {}) {
    const params = [limit];
    const conditions = [];
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `
      SELECT s.*, w.name AS workspace_name
      FROM signal_sources s
      JOIN workspaces w ON w.id = s.workspace_id
      ${where}
      ORDER BY s.created_at DESC
      LIMIT $1
      `,
      params
    );
    return result.rows;
  }

  async function getSource({ sourceId, actorId }) {
    const source = await db.query(
      `SELECT * FROM signal_sources WHERE id = $1`,
      [sourceId]
    );
    if (source.rows.length === 0) throw new NotFoundError('Source');

    const health = await db.query(
      `
      SELECT * FROM signal_source_health_snapshots
      WHERE source_id = $1 ORDER BY observed_at DESC LIMIT 5
      `,
      [sourceId]
    );

    const quality = await db.query(
      `
      SELECT * FROM signal_source_quality_snapshots
      WHERE source_id = $1 ORDER BY observed_at DESC LIMIT 5
      `,
      [sourceId]
    );

    const validations = await db.query(
      `
      SELECT * FROM signal_source_validations
      WHERE source_id = $1 ORDER BY started_at DESC LIMIT 5
      `,
      [sourceId]
    );

    await audit.write({
      actorId,
      action: 'signal_source.viewed',
      targetResource: 'signal_source',
      targetId: sourceId,
    });

    return {
      source: source.rows[0],
      health: health.rows,
      quality: quality.rows,
      validations: validations.rows,
    };
  }

  async function lifecycleAction({ sourceId, actorId, action, reason, scope }) {
    return sources.registry.getSourceForWorkspace({
      sourceId,
      workspaceId: null,
    }).then(() => {
      return sources.registry.pauseSource({
        userId: actorId,
        workspaceId: null,
        sourceId,
        reason,
      }).then((result) => {
        return audit.write({
          actorId,
          action: `signal_source.${action}`,
          targetResource: 'signal_source',
          targetId: sourceId,
          reason,
          after: { action, scope },
        }).then(() => result);
      });
    });
  }

  return {
    listSources,
    getSource,
    lifecycleAction,
  };
}

export default createAdminSignalSourceService;