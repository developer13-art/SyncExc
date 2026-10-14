/**
 * SyncExc Server — Audit service
 *
 * Writes append-only audit events to Postgres. Every consequential action
 * across the platform must produce an audit record here.
 *
 * Never includes secrets in before/after payloads. Callers are expected to
 * pass already-redacted values.
 */

import { createLogger } from './logger.js';
import { AppError } from './errors.js';

const logger = createLogger({ component: 'audit' });

export function createAuditService({ db }) {
  return {
    /**
     * Write an audit event.
     *
     * @param {Object} opts
     * @param {string}  opts.action          e.g. "user.suspend"
     * @param {string}  opts.resourceType    e.g. "user"
     * @param {string}  opts.resourceId
     * @param {string}  [opts.actorId]
     * @param {string}  [opts.workspaceId]
     * @param {Object}  [opts.before]
     * @param {Object}  [opts.after]
     * @param {string}  opts.outcome         success | failure | denied | partial
     * @param {string}  [opts.correlationId]
     * @param {Object}  [opts.metadata]
     * @param {string}  [opts.ip]
     * @param {string}  [opts.userAgent]
     * @returns {Promise<{ id: string }>}
     */
    async write({
      action,
      resourceType,
      resourceId,
      actorId = null,
      workspaceId = null,
      before = null,
      after = null,
      outcome = 'success',
      correlationId = null,
      metadata = null,
      ip = null,
      userAgent = null,
    }) {
      if (!action || !resourceType || !resourceId) {
        throw new AppError('Audit event missing required fields', {
          code: 'AUDIT_INVALID_EVENT',
          status: 500,
        });
      }

      try {
        const res = await db.query(
          `
          INSERT INTO audit_events (
            actor_id, workspace_id, action, resource_type, resource_id,
            before, after, outcome, correlation_id, metadata, ip, user_agent
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
          `,
          [
            actorId,
            workspaceId,
            action,
            resourceType,
            resourceId,
            before ? JSON.stringify(before) : null,
            after ? JSON.stringify(after) : null,
            outcome,
            correlationId,
            metadata ? JSON.stringify(metadata) : null,
            ip,
            userAgent,
          ]
        );

        const id = res.rows[0].id;
        logger.debug({ auditId: id, action, resourceType, resourceId }, 'Audit event written');
        return { id };
      } catch (err) {
        logger.error({ err, action, resourceType, resourceId }, 'Failed to write audit event');
        throw new AppError('Failed to persist required audit event', {
          code: 'AUDIT_PERSISTENCE_FAILURE',
          status: 500,
          cause: err,
        });
      }
    },

    /**
     * Query audit events with filters.
     */
    async query({
      actorId,
      workspaceId,
      action,
      resourceType,
      resourceId,
      outcome,
      from,
      to,
      limit = 100,
      cursor = null,
    } = {}) {
      const conditions = [];
      const params = [];

      if (actorId) {
        params.push(actorId);
        conditions.push(`actor_id = $${params.length}`);
      }
      if (workspaceId) {
        params.push(workspaceId);
        conditions.push(`workspace_id = $${params.length}`);
      }
      if (action) {
        params.push(action);
        conditions.push(`action = $${params.length}`);
      }
      if (resourceType) {
        params.push(resourceType);
        conditions.push(`resource_type = $${params.length}`);
      }
      if (resourceId) {
        params.push(resourceId);
        conditions.push(`resource_id = $${params.length}`);
      }
      if (outcome) {
        params.push(outcome);
        conditions.push(`outcome = $${params.length}`);
      }
      if (from) {
        params.push(from);
        conditions.push(`occurred_at >= $${params.length}`);
      }
      if (to) {
        params.push(to);
        conditions.push(`occurred_at <= $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`occurred_at < $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit + 1);

      const res = await db.query(
        `
        SELECT *
        FROM audit_events
        ${where}
        ORDER BY occurred_at DESC
        LIMIT $${params.length}
        `,
        params
      );

      const hasMore = res.rows.length > limit;
      const items = hasMore ? res.rows.slice(0, limit) : res.rows;
      const last = items[items.length - 1];
      return {
        items,
        nextCursor: hasMore && last ? last.occurred_at : null,
      };
    },
  };
}

export default createAuditService;