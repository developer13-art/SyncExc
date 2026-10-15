/**
 * SyncExc Server — Event publisher
 *
 * Two responsibilities:
 *   1. Poll the outbox for pending events and dispatch them.
 *   2. Fan out events to (a) the in-process bus and (b) the subscriber
 *      registry (for external consumers such as webhook dispatchers).
 *
 * Runs on an interval. Uses FOR UPDATE SKIP LOCKED so multiple publisher
 * workers can run in parallel safely.
 */

import { createLogger } from '../lib/logger.js';
import { sleep } from '@syncexc/shared';

const POLL_INTERVAL_MS = 500;
const BATCH_SIZE = 100;
const MAX_CONCURRENT = 20;

export function createPublisher({ db, bus, subscribers, envelope, logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'events:publisher' });

  let running = false;
  let loopPromise = null;
  let stopRequested = false;

  async function dispatchOne(event) {
    try {
      // 1. Validate envelope
      let validated;
      try {
        validated = envelope.validate(event);
      } catch (err) {
        logger.error({ err, eventId: event.eventId }, 'Invalid outbox event');
        await db.query(
          `UPDATE outbox_events SET status = 'dead_lettered', last_error = $2 WHERE id = $1`,
          [event.eventId, `invalid_envelope: ${err.message}`.slice(0, 1000)]
        );
        return;
      }

      // 2. Emit to in-process bus (fire-and-forget; listeners handle errors)
      bus.emit(validated.eventType, validated);

      // 3. Dispatch to registered subscribers
      const handlers = subscribers.getHandlers(validated.eventType);
      const results = await Promise.allSettled(
        handlers.map((handler) => handler(validated))
      );

      const failures = results.filter((r) => r.status === 'rejected');

      if (failures.length > 0) {
        for (const failure of failures) {
          logger.error(
            { err: failure.reason, eventType: validated.eventType, eventId: event.eventId },
            'Subscriber handler failed'
          );
        }
        throw new Error(`${failures.length} subscriber handler(s) failed`);
      }

      // 4. Mark published
      await db.query(
        `UPDATE outbox_events SET status = 'published', published_at = now() WHERE id = $1`,
        [event.eventId]
      );

      logger.trace(
        { eventType: validated.eventType, eventId: event.eventId, handlers: handlers.length },
        'Event published'
      );
    } catch (err) {
      // On failure, revert to pending (or dead-letter if attempts exceeded)
      await db.query(
        `
        UPDATE outbox_events
        SET status = CASE
              WHEN attempts >= 10 THEN 'dead_lettered'
              ELSE 'pending'
            END,
            last_error = $2
        WHERE id = $1
        `,
        [event.eventId, String(err.message).slice(0, 1000)]
      );

      logger.warn(
        { err, eventId: event.eventId, eventType: event.eventType },
        'Event dispatch failed'
      );
    }
  }

  async function pollOnce() {
    const events = await claimBatch(BATCH_SIZE);
    if (events.length === 0) return 0;

    // Process with bounded concurrency
    const queue = [...events];
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        await dispatchOne(next);
      }
    });
    await Promise.all(workers);

    return events.length;
  }

  async function claimBatch(batchSize) {
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
                o.resource_type, o.resource_id, o.occurred_at
      `,
      [batchSize]
    );

    return result.rows.map((row) => envelope.fromOutboxRow(row));
  }

  async function runLoop() {
    while (!stopRequested) {
      try {
        const processed = await pollOnce();
        if (processed === 0) {
          await sleep(POLL_INTERVAL_MS);
        }
      } catch (err) {
        logger.error({ err }, 'Publisher poll iteration failed');
        await sleep(1000);
      }
    }
  }

  return {
    async start() {
      if (running) return;
      running = true;
      stopRequested = false;
      loopPromise = runLoop();
      logger.info({ intervalMs: POLL_INTERVAL_MS }, 'Event publisher started');
    },

    async stop() {
      stopRequested = true;
      if (loopPromise) await loopPromise;
      running = false;
      logger.info('Event publisher stopped');
    },

    async shutdown() {
      await this.stop();
    },

    /**
     * Trigger a one-shot poll. Useful for tests and for draining after a
     * graceful shutdown signal.
     */
    async pollOnce() {
      return pollOnce();
    },
  };
}

export default createPublisher;