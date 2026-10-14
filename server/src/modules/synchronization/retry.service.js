/**
 * SyncExc Server — Retry scheduler
 */

import { backoffDelay } from '@syncexc/shared';

export function createRetryScheduler({ db, queries, jobs, logger }) {
  async function scheduleRetry({ destinationOperationId, failureCategory }) {
    // Compute the next retry delay
    const result = await db.query(
      `SELECT count(*)::int AS count FROM sync_retry_jobs WHERE destination_operation_id = $1`,
      [destinationOperationId]
    );
    const attemptNumber = (result.rows[0]?.count || 0) + 1;
    const delayMs = backoffDelay(attemptNumber - 1, 30000, 3600000);

    const scheduledAt = new Date(Date.now() + delayMs);

    await db.query(
      `
      INSERT INTO sync_retry_jobs (
        destination_operation_id, attempt_number, scheduled_at, failure_category
      )
      VALUES ($1, $2, $3, $4)
      `,
      [destinationOperationId, attemptNumber, scheduledAt, failureCategory]
    );

    // Enqueue a job at the scheduled time
    await jobs.enqueue(
      'sync_dispatch',
      { destinationOperationId },
      { scheduledAt, maxAttempts: 1 }
    );

    logger.debug(
      { destinationOperationId, attemptNumber, delayMs },
      'Sync retry scheduled'
    );
  }

  return {
    scheduleRetry,
  };
}

export default createRetryScheduler;