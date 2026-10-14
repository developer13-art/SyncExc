/**
 * SyncExc Server — Job scheduler
 *
 * Registers recurring jobs (cron-style) and enqueues them at the right time.
 * Uses a simple interval-based loop rather than a full cron parser — the
 * schedule is defined as a set of "next run" calculators.
 *
 * Each schedule has:
 *   - name              unique identifier
 *   - type              job type to enqueue
 *   - payload           fixed payload or a function that produces one
 *   - intervalMs        minimum interval between runs
 *   - dailyAt           optional { hour, minute } in UTC
 *   - runOnce           optional boolean; run immediately on boot
 *
 * State (last run) is kept in-memory. If the process restarts, schedules
 * re-evaluate on the next tick — they do NOT try to catch up missed runs.
 */

import { createLogger } from '../lib/logger.js';
import { sleep } from '@syncexc/shared';

const TICK_INTERVAL_MS = 30 * 1000; // evaluate every 30s

export function createJobScheduler({ db, runner, logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'jobs:scheduler' });

  const schedules = new Map(); // name -> schedule
  let running = false;
  let stopRequested = false;
  let loopPromise = null;

  /**
   * Compute the next run time for a schedule.
   */
  function computeNextRun(schedule, lastRunAt) {
    if (schedule.dailyAt) {
      const now = new Date();
      const candidate = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          schedule.dailyAt.hour,
          schedule.dailyAt.minute,
          0,
          0
        )
      );
      if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
      return candidate;
    }

    if (schedule.intervalMs) {
      const base = lastRunAt ? lastRunAt.getTime() : Date.now();
      return new Date(base + schedule.intervalMs);
    }

    throw new Error(`Schedule ${schedule.name} has no interval or dailyAt`);
  }

  /**
   * Due check: should this schedule fire now?
   */
  function isDue(schedule, state) {
    const now = Date.now();

    if (!state.lastRunAt && schedule.runOnce) return true;
    if (!state.nextRunAt) return true;

    return state.nextRunAt.getTime() <= now;
  }

  async function tick() {
    const now = new Date();
    for (const [name, schedule] of schedules.entries()) {
      try {
        const state = schedule.state;
        if (!isDue(schedule, state)) continue;

        // Enqueue the job
        const payload =
          typeof schedule.payload === 'function'
            ? await schedule.payload()
            : schedule.payload;

        const result = await runner.enqueue(schedule.type, payload, {
          priority: schedule.priority,
          maxAttempts: schedule.maxAttempts,
        });

        state.lastRunAt = now;
        state.nextRunAt = computeNextRun(schedule, now);
        state.totalRuns += 1;
        state.lastJobId = result.id;

        logger.debug(
          {
            schedule: name,
            type: schedule.type,
            jobId: result.id,
            nextRunAt: state.nextRunAt,
          },
          'Scheduled job enqueued'
        );
      } catch (err) {
        logger.error({ err, schedule: name }, 'Failed to run scheduled job');
      }
    }
  }

  async function runLoop() {
    // Initial evaluation (handles runOnce schedules)
    await tick();

    while (!stopRequested) {
      await sleep(TICK_INTERVAL_MS);
      if (stopRequested) break;
      await tick();
    }
  }

  return {
    /**
     * Register a recurring schedule.
     */
    add({ name, type, payload, intervalMs, dailyAt, runOnce = false, priority, maxAttempts }) {
      if (schedules.has(name)) {
        throw new Error(`Schedule '${name}' already registered`);
      }
      if (!intervalMs && !dailyAt) {
        throw new Error(`Schedule '${name}' must specify intervalMs or dailyAt`);
      }

      const state = {
        lastRunAt: null,
        nextRunAt: null,
        totalRuns: 0,
        lastJobId: null,
      };

      const schedule = {
        name,
        type,
        payload,
        intervalMs,
        dailyAt,
        runOnce,
        priority,
        maxAttempts,
        state,
      };

      // Initialize next run for non-runOnce schedules
      if (!runOnce) {
        state.nextRunAt = computeNextRun(schedule, null);
      }

      schedules.set(name, schedule);
      logger.debug({ name, type, intervalMs, dailyAt }, 'Schedule registered');
    },

    /**
     * List registered schedules (for diagnostics).
     */
    list() {
      return Array.from(schedules.values()).map((s) => ({
        name: s.name,
        type: s.type,
        intervalMs: s.intervalMs,
        dailyAt: s.dailyAt,
        lastRunAt: s.state.lastRunAt,
        nextRunAt: s.state.nextRunAt,
        totalRuns: s.state.totalRuns,
      }));
    },

    /**
     * Manually trigger a schedule now.
     */
    async triggerNow(name) {
      const schedule = schedules.get(name);
      if (!schedule) throw new Error(`Schedule '${name}' not found`);
      const payload =
        typeof schedule.payload === 'function' ? await schedule.payload() : schedule.payload;
      const result = await runner.enqueue(schedule.type, payload, {
        priority: schedule.priority,
        maxAttempts: schedule.maxAttempts,
      });
      schedule.state.lastRunAt = new Date();
      return result;
    },

    async start() {
      if (running) return;
      running = true;
      stopRequested = false;
      loopPromise = runLoop();
      logger.info({ schedules: schedules.size }, 'Job scheduler started');
    },

    async stop() {
      stopRequested = true;
      if (loopPromise) await loopPromise;
      running = false;
      logger.info('Job scheduler stopped');
    },
  };
}

export default createJobScheduler;