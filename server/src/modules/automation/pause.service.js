/**
 * SyncExc Server — Pause service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createPauseService({ db, queries, events, logger }) {
  async function pauseWorkflow({ workspaceId, workflowId, reason }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) throw new NotFoundError('Workflow');

    return db.tx(async (tx) => {
      const updated = await queries.updateWorkflow(workflowId, { status: 'paused' });

      await events.publish(
        tx,
        'automation.workflow_paused',
        { workflowId, reason },
        {
          workspaceId,
          resourceType: 'automation_workflow',
          resourceId: workflowId,
        }
      );

      return updated;
    });
  }

  async function resumeWorkflow({ workspaceId, workflowId }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) throw new NotFoundError('Workflow');
    if (workflow.status !== 'paused') return workflow;

    return db.tx(async (tx) => {
      const updated = await queries.updateWorkflow(workflowId, { status: 'active' });

      await events.publish(
        tx,
        'automation.workflow_resumed',
        { workflowId },
        {
          workspaceId,
          resourceType: 'automation_workflow',
          resourceId: workflowId,
        }
      );

      return updated;
    });
  }

  return {
    pauseWorkflow,
    resumeWorkflow,
  };
}

export default createPauseService;