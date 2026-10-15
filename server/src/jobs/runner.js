/**
 * SyncExc Server — Durable job runner
 *
 * The runner polls `jobs` for pending rows, claims batches with
 * `FOR UPDATE SKIP LOCKED`, and dispatches each job to its handler.
 *
 * On success: job is marked completed.
 * On failure: attempt count is incremented; if attempts remain, the job is
 *   re-scheduled with exponential backoff; if not, it is dead-lettered.
 *
 * Concurrency is bounded by a configurable limit. Claim and execution are
 * separate so a slow job doesn't block the claim loop.
 */

import { createLogger } from '../lib/logger.js';
import { sleep, backoffDelay, withTimeout } from '@syncexc/shared';

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 20;
const CONCURRENCY = 10;
const HANDLER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per attempt
const MAX_ATTEMPTS = 5;
const DEAD_LETTER_ERROR_LIMIT = 2000;

export function createJobRunner({ db, registry, logger: injectedLogger, services }) {
  const logger = injectedLogger || createLogger({ component: 'jobs:runner' });

  let running = false;
  let stopRequested = false;
  let loopPromise = null;
  const activeJobs = new Set();

  /**
   * Enqueue a job.
   *
   * @param {string} type
   * @param {object} payload
   * @param {object} [options]
   * @param {Date}   [options.scheduledAt]  When to run (defaults to now)
   * @param {number} [options.priority]     Lower = earlier; default 100
   * @param {number} [options.maxAttempts]  Default 5
   * @param {string} [options.correlationId]
   * @returns {Promise<{ id: string }>}
   */
  async function enqueue(type, payload, options = {}) {
    const result = await db.query(
      `
      INSERT INTO jobs (
        job_type, payload, priority, scheduled_at, max_attempts, correlation_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [
        type,
        JSON.stringify(payload || {}),
        options.priority ?? 100,
        options.scheduledAt || new Date(),
        options.maxAttempts ?? MAX_ATTEMPTS,
        options.correlationId || null,
      ]
    );
    return { id: result.rows[0].id };
  }

  /**
   * Enqueue many jobs of the same type in one insert.
   */
  async function enqueueBulk(type, payloads, options = {}) {
    if (!Array.isArray(payloads) || payloads.length === 0) return { ids: [] };
    const values = [];
    const params = [];
    let idx = 1;
    for (const payload of payloads) {
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(
        type,
        JSON.stringify(payload || {}),
        options.priority ?? 100,
        options.scheduledAt || new Date(),
        options.maxAttempts ?? MAX_ATTEMPTS,
        options.correlationId || null
      );
    }
    const result = await db.query(
      `
      INSERT INTO jobs (job_type, payload, priority, scheduled_at, max_attempts, correlation_id)
      VALUES ${values.join(', ')}
      RETURNING id
      `,
      params
    );
    return { ids: result.rows.map((r) => r.id) };
  }

  /**
   * Claim a batch of pending jobs.
   */
  async function claimBatch(limit) {
    const result = await db.query(
      `
      WITH claimed AS (
        SELECT id
        FROM jobs
        WHERE status IN ('pending', 'retry_scheduled')
          AND scheduled_at <= now()
        ORDER BY priority ASC, scheduled_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE jobs j
      SET status = 'running',
          started_at = now(),
          attempts = j.attempts + 1
      FROM claimed
      WHERE j.id = claimed.id
      RETURNING j.id, j.job_type, j.payload, j.attempts, j.max_attempts, j.correlation_id
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: row.job_type,
      payload: row.payload,
      attempt: row.attempts,
      maxAttempts: row.max_attempts,
      correlationId: row.correlation_id,
    }));
  }

  /**
   * Mark a job completed.
   */
  async function markCompleted(jobId) {
    await db.query(
      `UPDATE jobs SET status = 'completed', completed_at = now() WHERE id = $1`,
      [jobId]
    );
  }

  /**
   * Handle a job failure. Increment attempt, schedule retry or dead-letter.
   */
  async function handleFailure(job, error) {
    const nextAttempt = job.attempt + 1;
    const errMsg = String(error?.message || error).slice(0, DEAD_LETTER_ERROR_LIMIT);

    if (nextAttempt >= job.maxAttempts) {
      await db.query(
        `
        UPDATE jobs
        SET status = 'dead_lettered', dead_letter_at = now(), last_error = $2
        WHERE id = $1
        `,
        [job.id, errMsg]
      );
      logger.error(
        { jobId: job.id, type: job.type, attempts: nextAttempt, err: errMsg },
        'Job dead-lettered'
      );
      return;
    }

    const delay = backoffDelay(nextAttempt - 1, 1000, 300000);
    const nextRunAt = new Date(Date.now() + delay);

    await db.query(
      `
      UPDATE jobs
      SET status = 'retry_scheduled',
          scheduled_at = $2,
          last_error = $3
      WHERE id = $1
      `,
      [job.id, nextRunAt, errMsg]
    );

    logger.warn(
      { jobId: job.id, type: job.type, attempt: nextAttempt, nextRunAt, err: errMsg },
      'Job scheduled for retry'
    );
  }

  /**
   * Execute one job.
   */
  async function executeJob(job, services) {
    const handler = registry.get(job.type);
    if (!handler) {
      // Unknown type → dead-letter immediately
      await db.query(
        `
        UPDATE jobs
        SET status = 'dead_lettered', dead_letter_at = now(),
            last_error = 'no_handler_registered'
        WHERE id = $1
        `,
        [job.id]
      );
      logger.error({ jobId: job.id, type: job.type }, 'No handler for job type');
      return;
    }

    const started = Date.now();

    try {
      await withTimeout(
        handler({
          payload: job.payload,
          jobId: job.id,
          attempt: job.attempt,
          services,
        }),
        HANDLER_TIMEOUT_MS,
        `Job ${job.id} (${job.type}) timed out after ${HANDLER_TIMEOUT_MS}ms`
      );

      await markCompleted(job.id);

      // Record a job run for diagnostics
      await db.query(
        `
        INSERT INTO job_runs (job_id, attempt_number, outcome, duration_ms, completed_at)
        VALUES ($1, $2, 'completed', $3, now())
        `,
        [job.id, job.attempt, Date.now() - started]
      );

      logger.debug(
        { jobId: job.id, type: job.type, durationMs: Date.now() - started },
        'Job completed'
      );
    } catch (err) {
      await handleFailure(job, err);

      // Record the failed attempt
      try {
        await db.query(
          `
          INSERT INTO job_runs (job_id, attempt_number, outcome, error_message, duration_ms, completed_at)
          VALUES ($1, $2, 'failed', $3, $4, now())
          `,
          [job.id, job.attempt, String(err.message).slice(0, 1000), Date.now() - started]
        );
      } catch (logErr) {
        logger.error({ err: logErr, jobId: job.id }, 'Failed to record job run');
      }
    }
  }

  /**
   * Main loop.
   */
  async function runLoop(services) {
    while (!stopRequested) {
      try {
        const available = CONCURRENCY - activeJobs.size;
        if (available <= 0) {
          await sleep(50);
          continue;
        }

        const batch = await claimBatch(Math.min(BATCH_SIZE, available));
        if (batch.length === 0) {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }

        for (const job of batch) {
          activeJobs.add(job.id);
          executeJob(job, services)
            .catch((err) => {
              logger.error({ err, jobId: job.id }, 'Uncaught error in job execution');
            })
            .finally(() => {
              activeJobs.delete(job.id);
            });
        }
      } catch (err) {
        logger.error({ err }, 'Job runner loop failed');
        await sleep(2000);
      }
    }
  }

  return {
    async start() {
      if (running) return;
      running = true;
      stopRequested = false;
      loopPromise = runLoop(services);
      logger.info(
        { concurrency: CONCURRENCY, pollIntervalMs: POLL_INTERVAL_MS },
        'Job runner started'
      );
    },

    async stop() {
      stopRequested = true;
      if (loopPromise) await loopPromise;

      // Wait for in-flight jobs to finish (bounded)
      const start = Date.now();
      while (activeJobs.size > 0 && Date.now() - start < 30000) {
        await sleep(100);
      }

      running = false;
      logger.info({ remaining: activeJobs.size }, 'Job runner stopped');
    },

    enqueue,
    enqueueBulk,

    // Exposed for tests
    pollOnce: (services) => runLoop.call({ services }, { stopRequested: true }),
  };
}

export default createJobRunner;