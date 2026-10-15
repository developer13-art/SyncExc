/**
 * SyncExc Server — Transactional outbox
 *
 * The writer must be called inside a database transaction. It inserts a row
 * into `outbox_events` in the same transaction as the state change, so
 * either both commit or neither does.
 *
 * The reader (used by the publisher worker) fetches pending rows and marks
 * them published or failed.
 */

import { createLogger } from '../lib/logger.js';

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 10;

export function createOutbox({ db, envelope, logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'events:outbox' });

  return {
    /**
     * Enqueue an event inside a transaction.
     *
     * @param {object} tx              Transaction client (from db.tx(fn))
     * @param {string} eventType
     * @param {object} payload
     * @param {object} [options]       Envelope options
     * @returns {Promise<{ eventId: string }>}
     */
    async enqueue(tx, eventType, payload, options = {}) {
      if (!tx || typeof tx.query !== 'function') {
        throw new Error('Outbox.enqueue requires a transaction client');
      }

      const envelopeData = envelope.create(eventType, payload, options);

      await tx.query(
        `
        INSERT INTO outbox_events (
          id, event_type, schema_version, payload, correlation_id,
          actor_id, workspace_id, resource_type, resource_id, occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          envelopeData.eventId,
          envelopeData.eventType,
          envelopeData.schemaVersion,
          JSON.stringify(envelopeData.payload),
          envelopeData.correlationId,
          envelopeData.actorId,
          envelopeData.workspaceId,
          envelopeData.resourceType,
          envelopeData.resourceId || null,
          envelopeData.occurredAt,
        ]
      );

      logger.debug(
        { eventType, eventId: envelopeData.eventId },
        'Outbox event enqueued'
      );

      return { eventId: envelopeData.eventId };
    },

    /**
     * Fetch pending outbox events ready for publishing.
     * Uses SKIP LOCKED so multiple publisher workers can run safely.
     */
    async claimBatch({ batchSize = BATCH_SIZE } = {}) {
      const result = await db.query(
        `
        WITH claimed AS (
          SELECT id
          FROM outbox_events
          WHERE status = 'pending'
            AND occurred_at <= now()
          ORDER BY occurred_at
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE outbox_events o
        SET status = 'publishing',
            attempts = o.attempts + 1
        FROM claimed
        WHERE o.id = claimed.id
        RETURNING o.id, o.event_type, o.schema_version, o.payload,
                  o.correlation_id, o.actor_id, o.workspace_id,
                  o.resource_type, o.resource_id, o.occurred_at,
                  o.attempts
        `,
        [batchSize]
      );

      return result.rows.map((row) => ({
        id: row.id,
        eventId: row.id,
        eventType: row.event_type,
        schemaVersion: row.schema_version,
        payload: row.payload,
        correlationId: row.correlation_id,
        actorId: row.actor_id,
        workspaceId: row.workspace_id,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        occurredAt: row.occurred_at.toISOString(),
        ingestedAt: new Date().toISOString(),
        attempts: row.attempts,
      }));
    },

    /**
     * Mark a batch of events as published.
     */
    async markPublished(eventIds) {
      if (eventIds.length === 0) return 0;
      const result = await db.query(
        `
        UPDATE outbox_events
        SET status = 'published', published_at = now()
        WHERE id = ANY($1::uuid[])
        `,
        [eventIds]
      );
      return result.rowCount;
    },

    /**
     * Mark an event as failed. If attempts exceed the maximum, dead-letter it.
     */
    async markFailed(eventId, errorMessage) {
      const result = await db.query(
        `
        UPDATE outbox_events
        SET status = CASE
              WHEN attempts >= $2 THEN 'dead_lettered'
              ELSE 'pending'
            END,
            last_error = $3
        WHERE id = $1
        RETURNING status, attempts
        `,
        [eventId, MAX_ATTEMPTS, String(errorMessage).slice(0, 1000)]
      );
      const row = result.rows[0];
      if (row && row.status === 'dead_lettered') {
        logger.error({ eventId, attempts: row.attempts }, 'Event dead-lettered');
      }
      return row;
    },

    /**
     * Purge published events older than a threshold.
     */
    async purgePublished({ olderThanDays = 30 } = {}) {
      const result = await db.query(
        `
        DELETE FROM outbox_events
        WHERE status = 'published'
          AND published_at < now() - ($1 || ' days')::interval
        `,
        [String(olderThanDays)]
      );
      return result.rowCount;
    },

    /**
     * Count pending events (for monitoring).
     */
    async pendingCount() {
      const result = await db.query(
        `SELECT count(*)::int AS count FROM outbox_events WHERE status = 'pending'`
      );
      return result.rows[0].count;
    },
  };
}

export default createOutbox;