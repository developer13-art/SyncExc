/**
 * SyncExc Server — Emergency pause service
 */

import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { EMERGENCY_PAUSE_SCOPE, EMERGENCY_PAUSE_STATUS } from '@syncexc/shared';

export function createEmergencyPauseService({ db, queries, realtime, events, logger }) {
  async function request({ userId, workspaceId, scope, scopeRef, reason }) {
    return db.tx(async (tx) => {
      const pause = await queries.insertEmergencyPause(tx, {
        workspaceId: scope === EMERGENCY_PAUSE_SCOPE.PLATFORM_WIDE ? null : workspaceId,
        scopeType: scope,
        scopeId: scopeRef || null,
        reason,
        initiatedBy: userId,
      });

      // Mark it as propagating and then active. In a real deployment, this
      // would trigger cache invalidation on all workers.
      await queries.updateEmergencyPauseStatus(pause.id, 'active');

      await events.publish(
        tx,
        'risk.emergency_pause_active',
        { pauseId: pause.id, scope, scopeRef, reason },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'emergency_pause',
          resourceId: pause.id,
        }
      );

      return { ...pause, status: 'active' };
    }).then((result) => {
      if (realtime) {
        realtime.broadcastToWorkspace(
          workspaceId,
          'risk.emergency_pause_active',
          { pauseId: result.id, scope, scopeRef, reason },
          { resourceType: 'emergency_pause', resourceId: result.id }
        );
      }
      return result;
    });
  }

  async function resume({ userId, workspaceId, pauseId }) {
    const { rows } = await db.query(
      `SELECT * FROM risk_emergency_pause_events WHERE id = $1`,
      [pauseId]
    );
    const pause = rows[0];
    if (!pause) throw new NotFoundError('Pause');
    if (pause.workspace_id && pause.workspace_id !== workspaceId) throw new NotFoundError('Pause');
    if (pause.status === 'resumed') throw new ConflictError('Pause is already resumed', 'ALREADY_RESUMED');

    return db.tx(async (tx) => {
      const updated = await queries.updateEmergencyPauseStatus(pauseId, 'resumed', new Date());

      await events.publish(
        tx,
        'risk.emergency_pause_resumed',
        { pauseId, scope: pause.scope_type, scopeRef: pause.scope_id },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'emergency_pause',
          resourceId: pauseId,
        }
      );

      return updated;
    });
  }

  /**
   * Check if an operation on the given scope is paused.
   * Consults platform-wide, workspace-wide, and specific scope pauses.
   */
  async function isPaused({ workspaceId, scope, scopeRef = null }) {
    const checks = [
      { scopeType: EMERGENCY_PAUSE_SCOPE.PLATFORM_WIDE, scopeId: null },
      { scopeType: EMERGENCY_PAUSE_SCOPE.WORKSPACE, scopeId: workspaceId },
    ];
    if (scope) {
      checks.push({ scopeType: scope, scopeId: scopeRef });
    }

    for (const check of checks) {
      const pause = await queries.findActivePause({
        scopeType: check.scopeType,
        scopeId: check.scopeId,
      });
      if (pause) {
        return { paused: true, pause };
      }
    }

    return { paused: false };
  }

  async function getActive({ workspaceId }) {
    const result = await db.query(
      `
      SELECT * FROM risk_emergency_pause_events
      WHERE (workspace_id = $1 OR scope_type = 'platform_wide')
        AND status IN ('requested', 'propagating', 'active')
      ORDER BY created_at DESC
      `,
      [workspaceId]
    );
    return result.rows;
  }

  async function listEvents({ workspaceId, limit, cursor }) {
    return queries.listPauseEvents({ workspaceId, limit, cursor });
  }

  return {
    request,
    resume,
    isPaused,
    getActive,
    listEvents,
  };
}

export default createEmergencyPauseService;