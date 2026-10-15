/**
 * SyncExc Server — Incidents controller
 */

import { success, created, paginated } from '../../lib/response.js';

export function createIncidentsController({ incidentService }) {
  return {
    async list(req, res) {
      const { rows, nextCursor } = await incidentService.listIncidents({
        status: req.query.status,
        severity: req.query.severity,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, { nextCursor, limit: Number(req.query.limit) || 50 });
    },

    async get(req, res) {
      const result = await incidentService.getIncident({
        incidentId: req.params.incidentId,
        actorId: req.auth?.userId || null,
        isStaff: Boolean(req.auth?.isStaff),
      });
      return success(res, result);
    },

    async create(req, res) {
      const incident = await incidentService.createIncident({
        title: req.body.title,
        severity: req.body.severity,
        summary: req.body.summary,
        affectedServices: req.body.affectedServices,
        affectedFeatures: req.body.affectedFeatures,
        incidentOwnerId: req.body.incidentOwnerId,
        customerFacingStatus: req.body.customerFacingStatus,
        actorId: req.auth.userId,
      });
      return created(res, incident);
    },

    async update(req, res) {
      const incident = await incidentService.updateIncident({
        incidentId: req.params.incidentId,
        actorId: req.auth.userId,
        updates: req.body,
        reason: req.body.reason,
      });
      return success(res, incident);
    },

    async resolve(req, res) {
      const incident = await incidentService.resolveIncident({
        incidentId: req.params.incidentId,
        actorId: req.auth.userId,
        summary: req.body.summary,
        postMortemRef: req.body.postMortemRef,
      });
      return success(res, incident);
    },

    async listEvents(req, res) {
      const result = await incidentService.getIncident({
        incidentId: req.params.incidentId,
        actorId: req.auth?.userId || null,
        isStaff: Boolean(req.auth?.isStaff),
      });
      return success(res, result.events);
    },

    async addEvent(req, res) {
      const event = await incidentService.addEvent({
        incidentId: req.params.incidentId,
        actorId: req.auth.userId,
        eventType: req.body.eventType,
        message: req.body.message,
        metadata: req.body.metadata,
      });
      return created(res, event);
    },

    async listComments(req, res) {
      const comments = await incidentService.listComments({
        incidentId: req.params.incidentId,
        isStaff: Boolean(req.auth?.isStaff),
      });
      return success(res, comments);
    },

    async addComment(req, res) {
      const comment = await incidentService.addComment({
        incidentId: req.params.incidentId,
        authorId: req.auth.userId,
        content: req.body.content,
        isInternal: req.body.isInternal,
      });
      return created(res, comment);
    },

    async linkTicket(req, res) {
      const result = await incidentService.linkTicket({
        incidentId: req.params.incidentId,
        ticketId: req.body.ticketId,
        actorId: req.auth.userId,
      });
      return created(res, result);
    },

    async linkAffectedWorkspace(req, res) {
      const result = await incidentService.linkAffectedWorkspace({
        incidentId: req.params.incidentId,
        workspaceId: req.body.workspaceId,
        actorId: req.auth.userId,
      });
      return created(res, result);
    },
  };
}

export default createIncidentsController;