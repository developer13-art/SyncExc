/**
 * SyncExc Server — External event consumers
 *
 * Some events must be delivered outside the server process:
 *   - webhook subscriptions (Module 14)
 *   - external integrations
 *   - notification fan-out
 *
 * The consumer wraps the publisher into a durable delivery pipeline:
 *   1. Persist the delivery intent in `event_deliveries`.
 *   2. Dispatch through registered transport(s).
 *   3. Retry with backoff on failure.
 *   4. Move to dead-letter after max attempts.
 *
 * Each transport registers itself with a unique `subscriber` name. The
 * consumer reads `event_subscriptions` to determine which transports care
 * about which events.
 */

import { createLogger } from '../lib/logger.js';
import { sleep, backoffDelay } from '@syncexc/shared';

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 10;

export function createConsumerRunner({ db, publisher, logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'events:consumer' });

  const transports = new Map();
  let running = false;
  let stopRequested = false;
  let loopPromise = null;

  /**
   * Register a transport.
   * @param {string} name
   * @param {(envelope: object, delivery: object) => Promise<void>} handler
   * @param {string[]} eventTypes
   */
  function registerTransport(name, handler, eventTypes) {
    transports.set(name, { handler, eventTypes });
    logger.debug({ name, eventTypes: eventTypes.length }, 'Transport registered');
  }

  async function ensureSubscriptions() {
    for (const [name, { eventTypes }] of transports.entries()) {
      for (const eventType of eventTypes) {
        await db.query(
          `
          INSERT INTO event_subscriptions (subscriber, event_type, enabled)
          VALUES ($1, $2, true)
          ON CONFLICT (subscriber, event_type) DO UPDATE SET enabled = true
          `,
          [name, eventType]
        );
      }
    }
  }

  /**
   * Called by the publisher for each dispatched event. Enqueues delivery
   * rows for any transport interested in the event.
   */
  async function fanOut(envelope) {
    const subscribers = await db.query(
      `
      SELECT subscriber
      FROM event_subscriptions
      WHERE event_type = $1 AND enabled = true
      `,
      [envelope.eventType]
    );

    for (const row of subscribers.rows) {
      await db.query(
        `
        INSERT INTO event_deliveries (subscriber, event_id, event_type, status, next_attempt_at)
        VALUES ($1, $2, $3, 'pending', now())
        ON CONFLICT DO NOTHING
        `,
        [row.subscriber, envelope.eventId, envelope.eventType]
      );
    }
  }

  async function claimBatch(batchSize) {
    const result = await db.query(
      `
      WITH claimed AS (
        SELECT id
        FROM event_deliveries
        WHERE status IN ('pending', 'retry_scheduled')
          AND next_attempt_at <= now()
        ORDER BY next_attempt_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE event_deliveries d
      SET status = 'processing',
          attempts = d.attempts + 1
      FROM claimed
      WHERE d.id = claimed.id
      RETURNING d.id, d.subscriber, d.event_id, d.event_type, d.attempts
      `,
      [batchSize]
    );
    return result.rows;
  }

  async function loadEvent(eventId) {
    const result = await db.query(
      `
      SELECT id, event_type, schema_version, payload, correlation_id,
             actor_id, workspace_id, resource_type, resource_id, occurred_at
      FROM outbox_events
      WHERE id = $1
      `,
      [eventId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      eventId: row.id,
      eventType: row.event_type,
      schemaVersion: row.schema_version,
      occurredAt: row.occurred_at.toISOString(),
      ingestedAt: new Date().toISOString(),
      correlationId: row.correlation_id,
      actorId: row.actor_id,
      workspaceId: row.workspace_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      payload: row.payload,
      idempotencyKey: null,
      sourceModule: row.event_type.split('.')[0],
    };
  }

  async function deliverOne(delivery) {
    const transport = transports.get(delivery.subscriber);
    if (!transport) {
      await db.query(
        `
        UPDATE event_deliveries
        SET status = 'failed', last_error = 'transport_not_registered'
        WHERE id = $1
        `,
        [delivery.id]
      );
      return;
    }

    const envelope = await loadEvent(delivery.event_id);
    if (!envelope) {
      await db.query(
        `UPDATE event_deliveries SET status = 'failed', last_error = 'event_not_found' WHERE id = $1`,
        [delivery.id]
      );
      return;
    }

    try {
      await transport.handler(envelope, delivery);
      await db.query(
        `UPDATE event_deliveries SET status = 'delivered', delivered_at = now() WHERE id = $1`,
        [delivery.id]
      );
    } catch (err) {
      const attempts = delivery.attempts;
      const next = attempts >= MAX_ATTEMPTS ? null : new Date(Date.now() + backoffDelay(attempts, 1000, 300000));

      if (!next) {
        await db.query(
          `UPDATE event_deliveries SET status = 'dead_lettered', last_error = $2 WHERE id = $1`,
          [delivery.id, String(err.message).slice(0, 1000)]
        );
        logger.error(
          { deliveryId: delivery.id, subscriber: delivery.subscriber, err },
          'Delivery dead-lettered'
        );
      } else {
        await db.query(
          `
          UPDATE event_deliveries
          SET status = 'retry_scheduled', last_error = $2, next_attempt_at = $3
          WHERE id = $1
          `,
          [delivery.id, String(err.message).slice(0, 1000), next]
        );
      }
    }
  }

  async function runLoop() {
    while (!stopRequested) {
      try {
        const batch = await claimBatch(BATCH_SIZE);
        if (batch.length === 0) {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }

        const queue = [...batch];
        const workers = Array.from({ length: Math.min(10, queue.length) }, async () => {
          while (queue.length > 0) {
            const next = queue.shift();
            if (!next) break;
            await deliverOne(next);
          }
        });
        await Promise.all(workers);
      } catch (err) {
        logger.error({ err }, 'Consumer loop iteration failed');
        await sleep(1000);
      }
    }
  }

  return {
    registerTransport,

    async start() {
      if (running) return;
      running = true;
      stopRequested = false;
      await ensureSubscriptions();
      loopPromise = runLoop();
      logger.info('Event consumer started');
    },

    async stop() {
      stopRequested = true;
      if (loopPromise) await loopPromise;
      running = false;
      logger.info('Event consumer stopped');
    },

    async shutdown() {
      await this.stop();
    },

    /**
     * Publish an event AND fan it out to subscribers immediately.
     * Used by the publisher when dispatching outbox rows.
     */
    async dispatch(envelope) {
      await fanOut(envelope);
    },
  };
}

export default createConsumerRunner;