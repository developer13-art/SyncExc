import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { requireWorkspace } from '../../src/middleware/permission.js';

describe('workspace context authorization', () => {
  it('authorizes the workspace in the route instead of a different active-workspace header', async () => {
    const checkedWorkspaceIds = [];
    const middleware = requireWorkspace();
    const req = {
      auth: { isAuthenticated: true, userId: 'user-1' },
      headers: { 'x-workspace-id': 'active-workspace' },
      params: { workspaceId: 'route-workspace' },
      services: {
        workspaces: {
          async getMembership({ workspaceId }) {
            checkedWorkspaceIds.push(workspaceId);
            return { status: 'active', role: 'owner' };
          },
          async getWorkspaceById(id) {
            assert.equal(id, 'route-workspace');
            return { id, status: 'active', type: 'trader' };
          },
          async getEffectivePermissions({ workspaceId }) {
            assert.equal(workspaceId, 'route-workspace');
            return [];
          },
        },
      },
    };
    let nextError;
    await middleware(req, {}, (error) => {
      nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.deepEqual(checkedWorkspaceIds, ['route-workspace']);
    assert.equal(req.workspace.id, 'route-workspace');
  });

  it('does not let an active-workspace header grant access to another route workspace', async () => {
    const middleware = requireWorkspace();
    const req = {
      auth: { isAuthenticated: true, userId: 'user-1' },
      headers: { 'x-workspace-id': 'member-workspace' },
      params: { workspaceId: 'private-workspace' },
      services: {
        workspaces: {
          async getMembership({ workspaceId }) {
            assert.equal(workspaceId, 'private-workspace');
            return null;
          },
        },
      },
    };
    let nextError;
    await middleware(req, {}, (error) => {
      nextError = error;
    });

    assert.equal(nextError?.code, 'NOT_FOUND');
    assert.equal(req.workspace, undefined);
  });
});
