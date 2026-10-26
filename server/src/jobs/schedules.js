/**
 * SyncExc Server — Job schedules
 *
 * Registers recurring jobs. Every schedule has a name (unique), a job type,
 * and an interval or daily time.
 *
 * These are the baseline cadences. Any individual schedule can be tuned by
 * changing the interval; the payload is normally a fixed function that
 * produces the target list.
 */

import { createLogger } from '../lib/logger.js';

export async function registerAllSchedules({ scheduler }) {
  const logger = createLogger({ component: 'jobs:schedules' });

  /* ===========================================================================
   * EVERY 30 SECONDS — time-sensitive workers
   * ======================================================================== */

  scheduler.add({
    name: 'sync-reconcile-tick',
    type: 'sync_reconcile',
    intervalMs: 30 * 1000,
    payload: async () => ({ sweep: true }),
    priority: 50,
  });

  scheduler.add({
    name: 'terminal-order-reconcile-tick',
    type: 'terminal_reconcile',
    intervalMs: 15 * 1000,
    payload: async () => ({ limit: 100 }),
    priority: 40,
  });

  scheduler.add({
    name: 'outbox-publisher-tick',
    type: 'outbox_publish',
    intervalMs: 30 * 1000,
    priority: 100,
  });

  /* ===========================================================================
   * EVERY 5 MINUTES — operational health
   * ======================================================================== */

  scheduler.add({
    name: 'source-health-sweep',
    type: 'source_health',
    intervalMs: 5 * 60 * 1000,
    payload: async () => ({ sweep: true }),
  });

  scheduler.add({
    name: 'connection-health-sweep',
    type: 'connection_health',
    intervalMs: 5 * 60 * 1000,
    payload: async () => ({ sweep: true }),
  });

  /* ===========================================================================
   * EVERY 15 MINUTES — workflow scheduler tick
   * ======================================================================== */

  scheduler.add({
    name: 'workflow-schedule-tick',
    type: 'workflow_schedule',
    intervalMs: 15 * 60 * 1000,
    priority: 80,
  });

  /* ===========================================================================
   * EVERY HOUR — metrics, retention, reconciliation
   * ======================================================================== */

  scheduler.add({
    name: 'hourly-reconciliation',
    type: 'sync_reconcile',
    intervalMs: 60 * 60 * 1000,
    payload: async () => ({ sweep: true, all: true }),
  });

  scheduler.add({
    name: 'hourly-cleanup',
    type: 'cleanup',
    intervalMs: 60 * 60 * 1000,
    payload: async () => ({ target: 'all' }),
  });

  /* ===========================================================================
   * DAILY — at 02:00 UTC
   * ======================================================================== */

  scheduler.add({
    name: 'daily-cleanup',
    type: 'cleanup',
    intervalMs: 24 * 60 * 60 * 1000,
    dailyAt: { hour: 2, minute: 0 },
    payload: async () => ({ target: 'all' }),
  });

  /* ===========================================================================
   * DAILY — at 03:00 UTC — reconciliation
   * ======================================================================== */

  scheduler.add({
    name: 'daily-reconciliation',
    type: 'sync_reconcile',
    intervalMs: 24 * 60 * 60 * 1000,
    dailyAt: { hour: 3, minute: 0 },
    payload: async () => ({ sweep: true, all: true }),
  });

  /* ===========================================================================
   * MONTHLY — on the 1st at 04:00 UTC — referral settlement
   * ======================================================================== */

  scheduler.add({
    name: 'monthly-referral-settlement',
    type: 'referral_payout',
    intervalMs: 30 * 24 * 60 * 60 * 1000,
    payload: async () => ({ monthly: true }),
    priority: 120,
  });

  logger.debug({ schedules: scheduler.list().length }, 'All schedules registered');
}

export default registerAllSchedules;