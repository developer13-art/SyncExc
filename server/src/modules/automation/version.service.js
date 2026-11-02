/**
 * SyncExc Server — Version management
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createVersionService({ db, queries, events, logger }) {
  async function createDraftVersion({ userId, workspaceId, workflowId, definition }) {
    return db.tx(async (tx) => {
      const workflow = await queries.findWorkflowByIdForUpdate(tx, workflowId);
      if (!workflow || workflow.workspace_id !== workspaceId) throw new NotFoundError('Workflow');

      const latestVersion = await queries.findLatestVersion(workflowId, tx);
      const nextVersion = Math.max(
        Number(workflow.current_version) || 0,
        Number(latestVersion?.version) || 0,
      ) + 1;
      const version = await queries.insertVersion(tx, {
        workflowId,
        version: nextVersion,
        definition,
        isPublished: false,
      });
      if (!version) {
        throw new ConflictError('Unable to create the next workflow version. Please retry.');
      }

      // Write nodes and edges
      const nodes = definition.nodes || [];
      const edges = definition.edges || [];
      for (const node of nodes) {
        await queries.insertNode(tx, {
          versionId: version.id,
          nodeId: node.id,
          nodeType: node.type,
          category: node.category || 'utility',
          config: node.config || {},
          position: node.position,
        });
      }
      for (const edge of edges) {
        await queries.insertEdge(tx, {
          versionId: version.id,
          edgeId: edge.id,
          sourceNodeId: edge.source,
          sourcePort: edge.sourcePort,
          targetNodeId: edge.target,
          targetPort: edge.targetPort,
        });
      }

      await queries.updateWorkflow(workflowId, { currentVersion: nextVersion }, tx);

      return version;
    });
  }

  async function publishVersion({ userId, workspaceId, workflowId, versionId }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) throw new NotFoundError('Workflow');

    const version = await queries.findVersionById(versionId);
    if (!version || version.workflow_id !== workflowId) throw new NotFoundError('Version');

    return db.tx(async (tx) => {
      const published = await queries.markVersionPublished(versionId, userId, tx);

      await queries.updateWorkflow(workflowId, { status: 'active' }, tx);

      await events.publish(
        tx,
        'automation.workflow_published',
        { workflowId, versionId, version: version.version },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'automation_workflow',
          resourceId: workflowId,
        }
      );

      return published;
    });
  }

  async function listVersions({ workspaceId, workflowId }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) throw new NotFoundError('Workflow');
    return queries.listVersions(workflowId);
  }

  async function getVersion({ workspaceId, versionId }) {
    const version = await queries.findVersionById(versionId);
    if (!version) throw new NotFoundError('Version');
    const workflow = await queries.findWorkflowById(version.workflow_id);
    if (!workflow || workflow.workspace_id !== workspaceId) throw new NotFoundError('Version');
    return version;
  }

  return {
    createDraftVersion,
    publishVersion,
    listVersions,
    getVersion,
  };
}

export default createVersionService;