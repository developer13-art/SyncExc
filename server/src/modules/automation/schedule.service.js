/**
 * SyncExc Server — Schedule service
 *
 * Real cron parser: supports standard 5-field cron expressions
 * (minute hour day-of-month month day-of-week) plus a special
 * `@every <duration>` syntax.
 */

import { NotFoundError, ValidationError } from '../../lib/errors.js';

export function createScheduleService({ db, queries, events, logger }) {
  async function registerSchedules({ userId, workspaceId, workflowId, versionId, schedules }) {
    return db.tx(async (tx) => {
      const created = [];
      for (const schedule of schedules) {
        const nextRunAt = computeNextRun(schedule);
        if (!nextRunAt) {
          throw new ValidationError(`Invalid schedule expression: ${schedule.expression}`);
        }
        const s = await queries.insertSchedule(tx, {
          workflowId,
          versionId,
          scheduleType: schedule.type || 'recurring',
          cronExpression: schedule.expression,
          timezone: schedule.timezone || 'UTC',
          nextRunAt,
        });
        created.push(s);
      }
      return created;
    });
  }

  /**
   * Cron tick: enqueue runs for due schedules, compute next run times.
   * Called by the job runner on a schedule.
   */
  async function tick() {
    const due = await queries.listDueSchedules(100);
    let dispatched = 0;

    for (const schedule of due) {
      try {
        const workflow = await queries.findWorkflowById(schedule.workflow_id);
        if (!workflow || workflow.status !== 'active') {
          await queries.updateSchedule(schedule.id, {
            enabled: false,
          });
          continue;
        }

        const version = await queries.findVersionById(schedule.version_id);
        if (!version) continue;

        // Enqueue a run
        await db.tx(async (tx) => {
          await events.publish(
            tx,
            'automation.schedule_fired',
            {
              scheduleId: schedule.id,
              workflowId: workflow.id,
              versionId: version.id,
            },
            {
              workspaceId: workflow.workspace_id,
              resourceType: 'automation_schedule',
              resourceId: schedule.id,
            }
          );
        });

        // Compute next run
        const nextRun = computeNextRun({
          expression: schedule.cron_expression,
          timezone: schedule.timezone,
          from: new Date(),
        });

        await queries.updateSchedule(schedule.id, {
          lastRunAt: new Date(),
          nextRunAt: nextRun,
        });

        dispatched += 1;
      } catch (err) {
        logger.error({ err, scheduleId: schedule.id }, 'Schedule tick failed');
      }
    }

    return { dispatched };
  }

  /**
   * Compute the next run time for a schedule expression.
   * Supports:
   *   - @every <duration>       e.g. @every 5m, @every 1h
   *   - * / numbers in cron      e.g. "* /5 * * * *" (without space)
   *   - standard cron            "*/5 * * * *"
   */
  function computeNextRun({ expression, timezone = 'UTC', from = new Date() }) {
    if (!expression) return null;

    if (typeof expression === 'string' && expression.startsWith('@every ')) {
      const duration = parseDuration(expression.slice(7));
      if (!duration) return null;
      return new Date(from.getTime() + duration);
    }

    const parts = String(expression).trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const [minuteExpr, hourExpr, dayExpr, monthExpr, dowExpr] = parts;

    // Try the next minute up to one year ahead
    const candidate = new Date(from.getTime() + 60 * 1000);
    candidate.setSeconds(0, 0);

    for (let i = 0; i < 366 * 24 * 60; i += 1) {
      if (
        matchField(candidate.getUTCMinutes(), minuteExpr, 0, 59) &&
        matchField(candidate.getUTCHours(), hourExpr, 0, 23) &&
        matchField(candidate.getUTCDate(), dayExpr, 1, 31) &&
        matchField(candidate.getUTCMonth() + 1, monthExpr, 1, 12) &&
        matchField(candidate.getUTCDay(), dowExpr, 0, 6)
      ) {
        return candidate;
      }
      candidate.setMinutes(candidate.getMinutes() + 1);
    }

    return null;
  }

  function matchField(value, expr, min, max) {
    if (expr === '*') return true;

    // Handle comma-separated lists
    const parts = expr.split(',');
    for (const part of parts) {
      // Range: "1-5"
      if (part.includes('-')) {
        const [from, to] = part.split('-').map(Number);
        if (Number.isFinite(from) && Number.isFinite(to) && value >= from && value <= to) return true;
        continue;
      }

      // Step: "*/5" or "0-30/5"
      if (part.includes('/')) {
        const [range, step] = part.split('/').map(Number);
        if (!Number.isFinite(step) || step <= 0) continue;
        if (value % step === 0) return true;
        continue;
      }

      // Exact
      if (Number(part) === value) return true;
    }

    return false;
  }

  function parseDuration(str) {
    const m = String(str).trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const multipliers = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return n * multipliers[unit];
  }

  async function listSchedules({ workspaceId, workflowId }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) return [];
    return queries.listSchedulesForWorkflow(workflowId);
  }

  async function pauseSchedule({ workspaceId, workflowId, scheduleId }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) throw new NotFoundError('Workflow');
    return queries.updateSchedule(scheduleId, { enabled: false });
  }

  async function resumeSchedule({ workspaceId, workflowId, scheduleId }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) throw new NotFoundError('Workflow');

    const result = await db.query(
      `SELECT * FROM automation_schedules WHERE id = $1 AND workflow_id = $2`,
      [scheduleId, workflowId]
    );
    const schedule = result.rows[0];
    if (!schedule) throw new NotFoundError('Schedule');

    const nextRunAt = computeNextRun({
      expression: schedule.cron_expression,
      timezone: schedule.timezone,
    });

    return queries.updateSchedule(scheduleId, { enabled: true, nextRunAt });
  }

  return {
    registerSchedules,
    tick,
    computeNextRun,
    listSchedules,
    pauseSchedule,
    resumeSchedule,
  };
}

export default createScheduleService;