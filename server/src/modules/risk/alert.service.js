/**
 * SyncExc Server — Alert service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAlertService({ db, queries, events, realtime, logger }) {
  async function create({ workspaceId, severity, category, title, message, resourceType, resourceId }) {
    return db.tx(async (tx) => {
      return queries.insertAlert(tx, {
        workspaceId,
        severity,
        category,
        title,
        message,
        resourceType,
        resourceId,
      });
    }).then((alert) => {
      if (realtime && workspaceId) {
        realtime.broadcastToWorkspace(
          workspaceId,
          'risk.alert_created',
          { alertId: alert.id, severity, category, title },
          { resourceType: 'alert', resourceId: alert.id }
        );
      }
      return alert;
    });
  }

  async function list({ workspaceId, state, limit }) {
    return queries.listAlerts(workspaceId, { state, limit });
  }

  async function acknowledge({ alertId, workspaceId, userId }) {
    const alert = await queries.acknowledgeAlert(alertId, userId);
    if (!alert) throw new NotFoundError('Alert');
    return alert;
  }

  async function resolve({ alertId }) {
    const alert = await queries.resolveAlert(alertId);
    if (!alert) throw new NotFoundError('Alert');
    return alert;
  }

  return {
    create,
    list,
    acknowledge,
    resolve,
  };
}

export default createAlertService;