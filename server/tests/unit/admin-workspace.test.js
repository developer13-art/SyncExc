import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAdminWorkspaceService } from '../../src/modules/admin/admin-workspace.service.js';

describe('admin workspace detail', () => {
  it('returns workspace members and writes the audit using the audit service contract', async () => {
    const auditEvents = [];
    const workspace = { id: 'workspace-1', name: 'Trading' };
    const member = {
      id: 'membership-1',
      role: 'owner',
      user_email: 'owner@example.test',
      username: 'owner',
    };
    const db = {
      async query(sql) {
        if (sql.includes('FROM workspaces')) return { rows: [workspace] };
        if (sql.includes('FROM workspace_memberships')) return { rows: [member] };
        if (sql.includes('FROM subscriptions')) return { rows: [] };
        if (sql.includes('FROM connection_sharing_grants')) return { rows: [] };
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
    const service = createAdminWorkspaceService({
      db,
      queries: {},
      events: {},
      audit: {
        async write(event) {
          auditEvents.push(event);
        },
      },
      logger: {},
    });

    const result = await service.getWorkspace({
      workspaceId: workspace.id,
      actorId: 'admin-1',
    });

    assert.equal(result.workspace, workspace);
    assert.deepEqual(result.members, [member]);
    assert.equal(auditEvents[0].resourceType, 'workspace');
    assert.equal(auditEvents[0].resourceId, workspace.id);
    assert.equal(auditEvents[0].targetResource, undefined);
  });
});
