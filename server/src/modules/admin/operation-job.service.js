/**
 * SyncExc Server — Operation job service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createOperationJobService({ db, queries, events, audit, logger }) {
  async function createJob({ userId, jobType, scope, itemsTotal, reason }) {
    return db.tx(async (tx) => {
      const job = await queries.insertOperationJob(tx, {
        jobType,
        createdBy: userId,
        scope,
        itemsTotal,
      });

      await queries.insertOperationJobEvent(tx, {
        jobId: job.id,
        eventType: 'created',
        payload: { scope, itemsTotal, reason },
      });

      await audit.write({
        actorId: userId,
        action: `operation_job.${jobType}.created`,
        targetResource: 'admin_operation_job',
        targetId: job.id,
        after: { scope, itemsTotal, reason },
      });

      return job;
    });
  }

  async function listJobs({ state, limit }) {
    return queries.listOperationJobs({ state, limit });
  }

  async function getJob({ jobId, actorId }) {
    const job = await queries.findOperationJob(jobId);
    if (!job) throw new NotFoundError('Job');

    const events = await db.query(
      `
      SELECT * FROM admin_operation_job_events
      WHERE job_id = $1
      ORDER BY occurred_at ASC
      `,
      [jobId]
    );

    return { job, events: events.rows };
  }

  async function updateProgress({ jobId, fields }) {
    return queries.updateOperationJob(jobId, fields);
  }

  async function cancelJob({ jobId, actorId, reason }) {
    const result = await db.tx(async (tx) => {
      const updated = await queries.updateOperationJob(jobId, {
        state: 'cancellation_requested',
      });

      await queries.insertOperationJobEvent(tx, {
        jobId,
        eventType: 'cancellation_requested',
        payload: { reason },
      });

      await audit.write({
        actorId,
        action: 'operation_job.canceled',
        targetResource: 'admin_operation_job',
        targetId: jobId,
        reason,
      });

      return updated;
    });

    await events.publish(db, 'admin.operation_job_cancellation', {
      jobId,
      reason,
    }, {
      actorId,
      resourceType: 'admin_operation_job',
      resourceId: jobId,
    });

    return result;
  }

  return {
    createJob,
    listJobs,
    getJob,
    updateProgress,
    cancelJob,
  };
}

export default createOperationJobService;