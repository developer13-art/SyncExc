import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createWorkspacesController } from '../../src/modules/workspaces/workspaces.controller.js';
import { createWorkspacesService } from '../../src/modules/workspaces/workspaces.service.js';

describe('workspace list provisioning', () => {
  it('creates a personal workspace when an authenticated user has none', async () => {
    const workspaces = [];
    let provisionedUserId;
    const service = {
      async listWorkspacesForUser(userId) {
        return workspaces.filter((workspace) => workspace.userId === userId);
      },
      async ensurePersonalWorkspace(userId) {
        provisionedUserId = userId;
        workspaces.push({
          id: 'workspace-1',
          userId,
          name: 'Personal',
          type: 'personal',
          status: 'active',
          owner_id: userId,
          member_role: 'owner',
        });
      },
    };
    const controller = createWorkspacesController({ service });
    let response;
    const res = {
      status(statusCode) {
        response = { status: statusCode };
        return this;
      },
      json(body) {
        response.body = body;
        return this;
      },
      req: { headers: {} },
    };

    await controller.list({ auth: { userId: 'user-1' } }, res);

    assert.equal(provisionedUserId, 'user-1');
    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].memberRole, 'owner');
  });

  it('does not create an extra workspace when memberships already exist', async () => {
    let ensureCalled = false;
    const controller = createWorkspacesController({
      service: {
        async listWorkspacesForUser() {
          return [{
            id: 'workspace-existing',
            name: 'Existing',
            type: 'personal',
            status: 'active',
            owner_id: 'user-1',
            member_role: 'owner',
          }];
        },
        async ensurePersonalWorkspace() {
          ensureCalled = true;
        },
      },
    });
    const res = {
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
      req: { headers: {} },
    };

    await controller.list({ auth: { userId: 'user-1' } }, res);

    assert.equal(ensureCalled, false);
    assert.equal(res.body.data[0].id, 'workspace-existing');
  });
});

describe('personal workspace provisioning', () => {
  it('returns one personal workspace when concurrent requests race to provision it', async () => {
    let personalWorkspace = null;
    let transactionQueue = Promise.resolve();
    const roleNames = new Set();
    const createdEvents = [];
    const transaction = {
      async query(_sql, params) {
        return { rows: roleNames.has(params[1]) ? [{ exists: true }] : [] };
      },
    };
    const service = createWorkspacesService({
      db: {
        async tx(callback) {
          const transactionResult = transactionQueue.then(() => callback(transaction));
          transactionQueue = transactionResult.then(() => undefined, () => undefined);
          return transactionResult;
        },
      },
      queries: {
        async findPersonalWorkspaceForUser() {
          return personalWorkspace;
        },
        async insertPersonalWorkspace(_client, userId) {
          if (personalWorkspace) return null;
          personalWorkspace = { id: 'personal-workspace', owner_id: userId };
          return personalWorkspace;
        },
        async insertRole(_client, { name }) {
          roleNames.add(name);
        },
        async ensureOwnerMembership() {},
      },
      events: {
        async publish(_client, name) {
          if (name === 'workspace.created') createdEvents.push(name);
        },
      },
    });

    const [first, second] = await Promise.all([
      service.ensurePersonalWorkspace('user-1'),
      service.ensurePersonalWorkspace('user-1'),
    ]);

    assert.equal(first.id, 'personal-workspace');
    assert.equal(second.id, first.id);
    assert.equal(createdEvents.length, 1);
  });
});
