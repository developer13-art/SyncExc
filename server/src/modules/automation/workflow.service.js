/**
 * SyncExc Server — Workflow CRUD service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createWorkflowService({ db, queries, events, logger }) {
  async function createWorkflow({ userId, workspaceId, name, description }) {
    return db.tx(async (tx) => {
      const workflow = await queries.insertWorkflow(tx, {
        workspaceId,
        name,
        description,
        createdBy: userId,
      });

      // Create an initial empty draft version
      await queries.insertVersion(tx, {
        workflowId: workflow.id,
        version: 1,
        definition: { nodes: [], edges: [], input: {} },
        isPublished: false,
      });

      await queries.updateWorkflow(workflow.id, { currentVersion: 1 });

      await events.publish(
        tx,
        'automation.workflow_created',
        { workflowId: workflow.id, name },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'automation_workflow',
          resourceId: workflow.id,
        }
      );

      return workflow;
    });
  }

  async function getWorkflow({ workflowId, workspaceId }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) throw new NotFoundError('Workflow');
    return workflow;
  }

  async function listWorkflows({ workspaceId, status }) {
    return queries.listWorkflowsForWorkspace(workspaceId, { status });
  }

  async function updateWorkflow({ userId, workspaceId, workflowId, updates }) {
    const workflow = await getWorkflow({ workflowId, workspaceId });

    return db.tx(async (tx) => {
      const updated = await queries.updateWorkflow(workflowId, updates);
      return updated;
    });
  }

  async function deleteWorkflow({ userId, workspaceId, workflowId }) {
    const workflow = await getWorkflow({ workflowId, workspaceId });

    return db.tx(async (tx) => {
      const updated = await queries.updateWorkflow(workflowId, { status: 'retired' });
      return updated;
    });
  }

  return {
    createWorkflow,
    getWorkflow,
    listWorkflows,
    updateWorkflow,
    deleteWorkflow,
  };
}

export default createWorkflowService;