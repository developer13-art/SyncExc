/**
 * SyncExc Server — Incident service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createIncidentService({ db, queries, events, realtime, logger }) {
  async function create({
    workspaceId,
    category,
    severity,
    scopeType,
    scopeId,
    summary,
    assignedTo,
  }) {
    return db.tx(async (tx) => {
      const incident = await queries.insertIncident(tx, {
        workspaceId,
        category,
        severity,
        scopeType,
        scopeId,
        summary,
        assignedTo,
      });

      await queries.insertIncidentEvent(tx, {
        incidentId: incident.id,
        eventType: 'created',
        message: summary,
      });

      await events.publish(
        tx,
        'risk.incident_created',
        {
          incidentId: incident.id,
          category,
          severity,
        },
        {
          workspaceId,
          resourceType: 'incident',
          resourceId: incident.id,
        }
      );

      return incident;
    }).then((result) => {
      if (realtime) {
        realtime.broadcastToWorkspace(
          workspaceId,
          'risk.incident_created',
          { incidentId: result.id, category, severity, summary },
          { resourceType: 'incident', resourceId: result.id }
        );
      }
      return result;
    });
  }

  async function list({ workspaceId, status, limit, cursor }) {
    return queries.listIncidents(workspaceId, { status, limit, cursor });
  }

  async function get({ incidentId, workspaceId }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident || incident.workspace_id !== workspaceId) throw new NotFoundError('Incident');
    const events = await queries.listIncidentEvents(incidentId);
    return { incident, events };
  }

  async function addEvent({ incidentId, workspaceId, actorId, eventType, message, metadata }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident || incident.workspace_id !== workspaceId) throw new NotFoundError('Incident');

    return queries.insertIncidentEvent(null, {
      incidentId,
      eventType,
      actorId,
      message,
      metadata,
    });
  }

  async function resolve({ incidentId, workspaceId, userId, rootCause, prevention }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident || incident.workspace_id !== workspaceId) throw new NotFoundError('Incident');

    return db.tx(async (tx) => {
      const updated = await queries.updateIncidentStatus(incidentId, 'resolved', {
        resolvedAt: new Date(),
        rootCause,
        prevention,
      });

      await queries.insertIncidentEvent(tx, {
        incidentId,
        eventType: 'resolved',
        actorId: userId,
        message: rootCause,
      });

      await events.publish(
        tx,
        'risk.incident_resolved',
        { incidentId },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'incident',
          resourceId: incidentId,
        }
      );

      return updated;
    });
  }

  return {
    create,
    list,
    get,
    addEvent,
    resolve,
  };
}

export default createIncidentService;