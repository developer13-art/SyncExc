/**
 * SyncExc Server — Jobs subsystem
 *
 * A durable job queue backed by the `jobs` table in Postgres.
 *
 *   1. Anywhere in the server, call `jobs.enqueue(type, payload, options)`.
 *   2. The runner (a pool of workers) picks up pending jobs, dispatches
 *      them to the registered handler, and marks them completed or
 *      schedules a retry.
 *   3. The scheduler emits recurring jobs on a cron-like schedule.
 *
 * Handlers must be idempotent. A job may be delivered more than once if
 * the runner restarts mid-execution.
 */

import { createLogger } from '../lib/logger.js';
import { createJobRegistry } from './registry.js';
import { createJobRunner } from './runner.js';
import { createJobScheduler } from './scheduler.js';
import { registerAllHandlers } from './handlers.js';
import { registerAllSchedules } from './schedules.js';

export async function initJobs({ services }) {
  const logger = createLogger({ component: 'jobs' });

  const registry = createJobRegistry({ logger });
  const runner = createJobRunner({ db: services.db, registry, logger, services });
  const scheduler = createJobScheduler({ db: services.db, runner, logger });

  // Register every job handler exactly once
  await registerAllHandlers({ registry, services });
  logger.info({ handlers: registry.list().length }, 'Job handlers registered');

  // Register every recurring schedule
  await registerAllSchedules({ scheduler });
  logger.info({ schedules: scheduler.list().length }, 'Job schedules registered');

  await runner.start();
  await scheduler.start();

  return {
    enqueue: (...args) => runner.enqueue(...args),
    enqueueBulk: (...args) => runner.enqueueBulk(...args),
    registry,
    runner,
    scheduler,

    async shutdown() {
      logger.info('Shutting down jobs subsystem');
      await scheduler.stop();
      await runner.stop();
    },
  };
}

export default initJobs;