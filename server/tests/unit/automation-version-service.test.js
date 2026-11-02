import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConflictError } from '../../src/lib/errors.js';
import { createVersionService } from '../../src/modules/automation/version.service.js';

describe('automation version service', () => {
  it('locks the workflow and writes the next draft version in one transaction', async () => {
    const tx = { name: 'transaction' };
    const calls = [];
    const version = { id: 'version-5', version: 5 };
    const definition = {
      nodes: [{
        id: 'signal-1',
        type: 'signal_published',
        category: 'trigger',
        config: {},
        position: { x: 10, y: 20 },
      }],
      edges: [{
        id: 'edge-1',
        source: 'signal-1',
        sourcePort: 'out',
        target: 'condition-1',
        targetPort: 'in',
      }],
      input: {},
    };
    const service = createVersionService({
      db: {
        async tx(callback) {
          return callback(tx);
        },
      },
      queries: {
        async findWorkflowByIdForUpdate(client, workflowId) {
          calls.push(['lock', client, workflowId]);
          return { id: workflowId, workspace_id: 'workspace-1', current_version: 0 };
        },
        async findLatestVersion(workflowId, client) {
          calls.push(['latest', client, workflowId]);
          return { version: 4 };
        },
        async insertVersion(client, data) {
          calls.push(['version', client, data]);
          return version;
        },
        async insertNode(client, data) {
          calls.push(['node', client, data]);
        },
        async insertEdge(client, data) {
          calls.push(['edge', client, data]);
        },
        async updateWorkflow(workflowId, fields, client) {
          calls.push(['workflow', client, workflowId, fields]);
        },
      },
    });

    const result = await service.createDraftVersion({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      workflowId: 'workflow-1',
      definition,
    });

    assert.equal(result, version);
    assert.deepEqual(calls.map(([type]) => type), [
      'lock',
      'latest',
      'version',
      'node',
      'edge',
      'workflow',
    ]);
    assert.ok(calls.every(([, client]) => client === tx));
    assert.equal(calls[2][2].version, 5);
    assert.deepEqual(calls[5][3], { currentVersion: 5 });
  });

  it('returns a conflict instead of dereferencing a missing version after an insert conflict', async () => {
    const service = createVersionService({
      db: { async tx(callback) { return callback({}); } },
      queries: {
        async findWorkflowByIdForUpdate() {
          return { workspace_id: 'workspace-1', current_version: 4 };
        },
        async findLatestVersion() {
          return { version: 4 };
        },
        async insertVersion() {
          return null;
        },
        async insertNode() {
          assert.fail('Nodes must not be written when version insertion fails');
        },
      },
    });

    await assert.rejects(
      service.createDraftVersion({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        workflowId: 'workflow-1',
        definition: { nodes: [], edges: [] },
      }),
      (error) => error instanceof ConflictError && error.status === 409,
    );
  });
});
