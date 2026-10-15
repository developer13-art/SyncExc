/**
 * SyncExc Server — Incident service
 */

import { randomBytes } from 'node:crypto';
import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

const VALID_SEVERITIES = ['sev1', 'sev2', 'sev3', 'sev4'];
const VALID_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'];

function generateReference() {
  const year = new Date().getFullYear();
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `INC-${year}-${rand}`;
}

export function createIncidentService({ db, queries, events, realtime, notifications, logger }) {
  async function createIncident({
    title,
    severity,
    summary,
    affectedServices,
    affectedFeatures,
    incidentOwnerId,
    customerFacingStatus,
    actorId,
  }) {
    if (!title || !summary) {
      throw new ValidationError('title and summary are required');
    }
    if (!VALID_SEVERITIES.includes(severity)) {
      throw new ValidationError(`Invalid severity: ${severity}`);
    }

    const reference = generateReference();

    const incident = await db.tx(async (tx) => {
      const created = await queries.insertIncident(tx, {
        reference,
        title,
        severity,
        summary,
        affectedServices,
        affectedFeatures,
        incidentOwnerId,
        customerFacingStatus: customerFacingStatus || {
          title,
          summary,
          status: 'investigating',
          updatedAt: new Date().toISOString(),
        },
      });

      await queries.insertIncidentEvent(tx, {
        incidentId: created.id,
        eventType: 'created',
        actorId,
        message: summary,
      });

      return created;
    });

    // Broadcast to realtime
    if (realtime) {
      realtime.broadcast('incidents:global', 'platform.incident_created', {
        incidentId: incident.id,
        reference: incident.reference,
        severity: incident.severity,
        title: incident.title,
      });
    }

    // Emit for notification fan-out
    await events.publish(db, 'platform.incident_created', {
      incidentId: incident.id,
      reference: incident.reference,
      title: incident.title,
      severity: incident.severity,
      summary: incident.summary,
    }, {
      actorId,
      resourceType: 'platform_incident',
      resourceId: incident.id,
    });

    logger.warn(
      { incidentId: incident.id, severity, reference },
      'Platform incident created'
    );

    return incident;
  }

  async function getIncident({ incidentId, actorId, isStaff = false }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident) throw new NotFoundError('Incident');

    const incidentEvents = await queries.listIncidentEvents(incidentId);
    const comments = await queries.listComments(incidentId, { includeInternal: isStaff });
    const ticketLinks = await queries.listTicketLinks(incidentId);
    const affectedWorkspaces = await queries.listAffectedWorkspaces(incidentId);

    return {
      incident,
      events: incidentEvents,
      comments,
      ticketLinks,
      affectedWorkspaces,
    };
  }

  async function listIncidents({ status, severity, limit, cursor }) {
    return queries.listIncidents({ status, severity, limit, cursor });
  }

  async function updateIncident({
    incidentId,
    actorId,
    updates,
    reason,
  }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident) throw new NotFoundError('Incident');

    if (updates.severity && !VALID_SEVERITIES.includes(updates.severity)) {
      throw new ValidationError(`Invalid severity: ${updates.severity}`);
    }
    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      throw new ValidationError(`Invalid status: ${updates.status}`);
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateIncident(incidentId, updates);

      if (updates.status && updates.status !== incident.status) {
        await queries.insertIncidentEvent(tx, {
          incidentId,
          eventType: `status_changed_to_${updates.status}`,
          actorId,
          message: reason || `Status changed to ${updates.status}`,
        });
      } else if (Object.keys(updates).length > 0) {
        await queries.insertIncidentEvent(tx, {
          incidentId,
          eventType: 'updated',
          actorId,
          metadata: updates,
        });
      }

      await events.publish(
        tx,
        'platform.incident_updated',
        {
          incidentId,
          status: updated.status,
          severity: updated.severity,
        },
        {
          actorId,
          resourceType: 'platform_incident',
          resourceId: incidentId,
        }
      );

      return updated;
    }).then((updated) => {
      if (realtime) {
        realtime.broadcast('incidents:global', 'platform.incident_updated', {
          incidentId,
          status: updated.status,
          severity: updated.severity,
        });
      }
      return updated;
    });
  }

  async function resolveIncident({ incidentId, actorId, summary, postMortemRef }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident) throw new NotFoundError('Incident');
    if (incident.status === 'resolved') {
      throw new ConflictError('Incident already resolved', 'ALREADY_RESOLVED');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateIncident(incidentId, {
        status: 'resolved',
        resolvedAt: new Date(),
        closedAt: new Date(),
        postMortemRef,
        customerFacingStatus: {
          title: incident.title,
          summary: summary || incident.summary,
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        },
      });

      await queries.insertIncidentEvent(tx, {
        incidentId,
        eventType: 'resolved',
        actorId,
        message: summary || 'Incident resolved',
      });

      await events.publish(
        tx,
        'platform.incident_resolved',
        {
          incidentId,
          reference: incident.reference,
          title: incident.title,
        },
        {
          actorId,
          resourceType: 'platform_incident',
          resourceId: incidentId,
        }
      );

      return updated;
    }).then((updated) => {
      if (realtime) {
        realtime.broadcast('incidents:global', 'platform.incident_resolved', {
          incidentId,
          reference: incident.reference,
          title: incident.title,
        });
      }
      return updated;
    });
  }

  async function addEvent({ incidentId, actorId, eventType, message, metadata }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident) throw new NotFoundError('Incident');

    return db.tx(async (tx) => {
      return queries.insertIncidentEvent(tx, {
        incidentId,
        eventType,
        actorId,
        message,
        metadata,
      });
    });
  }

  async function addComment({ incidentId, authorId, content, isInternal }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident) throw new NotFoundError('Incident');

    return db.tx(async (tx) => {
      return queries.insertComment(tx, {
        incidentId,
        authorId,
        content,
        isInternal: isInternal !== false,
      });
    });
  }

  async function listComments({ incidentId, isStaff }) {
    return queries.listComments(incidentId, { includeInternal: isStaff });
  }

  async function linkTicket({ incidentId, ticketId, actorId }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident) throw new NotFoundError('Incident');

    return db.tx(async (tx) => {
      const link = await queries.insertTicketLink(tx, { incidentId, ticketId });
      if (link) {
        await queries.insertIncidentEvent(tx, {
          incidentId,
          eventType: 'ticket_linked',
          actorId,
          metadata: { ticketId },
        });
      }
      return link;
    });
  }

  async function linkAffectedWorkspace({ incidentId, workspaceId, actorId }) {
    const incident = await queries.findIncidentById(incidentId);
    if (!incident) throw new NotFoundError('Incident');

    return db.tx(async (tx) => {
      const link = await queries.upsertAffectedWorkspace(tx, {
        incidentId,
        workspaceId,
      });

      // Notify the workspace via the notifications module
      if (notifications) {
        await notifications.service.create({
          userId: null,
          eventType: 'platform.incident_created',
          category: 'platform',
          priority: 'critical',
          title: incident.title,
          message: incident.summary,
          action: { label: 'View status', url: `${process.env.APP_URL}/status` },
        }).catch((err) => {
          logger.warn({ err }, 'Failed to notify affected workspace');
        });
      }

      return link;
    });
  }

  return {
    createIncident,
    getIncident,
    listIncidents,
    updateIncident,
    resolveIncident,
    addEvent,
    addComment,
    listComments,
    linkTicket,
    linkAffectedWorkspace,
  };
}

export default createIncidentService;