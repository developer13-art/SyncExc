import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createWorkspacesService } from '../../src/modules/workspaces/workspaces.service.js';

function createService() {
  const transaction = {
    async query(sql) {
      if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 'user-1' }] };
      if (sql.includes('SELECT count(*)::int AS count')) return { rows: [{ count: 0 }] };
      return { rows: [] };
    },
  };
  const auditEvents = [];
  const queries = {
    async findPersonalWorkspaceForUser() {
      return { id: 'personal-workspace' };
    },
    async insertWorkspace(_client, data) {
      return { id: 'new-workspace', ...data };
    },
    async insertRole() {},
    async insertMembership() {},
    async ensureOwnerMembership() {},
    async insertWorkspaceAuditEvent(data, client) {
      auditEvents.push({ data, client });
    },
  };
  const service = createWorkspacesService({
    db: {
      async query() {
        return { rows: [{ count: 0 }] };
      },
      async tx(callback) {
        return callback(transaction);
      },
    },
    queries,
    events: { async publish() {} },
  });

  return { service, transaction, auditEvents };
}

describe('workspace creation audit events', () => {
  it('writes organization workspace audit events in the creation transaction', async () => {
    const { service, transaction, auditEvents } = createService();

    await service.createOrganizationWorkspace({
      userId: 'user-1',
      name: 'Organization',
    });

    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0].client, transaction);
  });

  it('writes trader workspace audit events in the creation transaction', async () => {
    const { service, transaction, auditEvents } = createService();

    await service.createSpecializedWorkspace({
      userId: 'user-1',
      type: 'trader',
      name: 'Trading',
    });

    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0].client, transaction);
  });

  it('uses the billing entitlement when enforcing Trader workspace creation limits', async () => {
    const transaction = {
      async query(sql) {
        if (sql.includes('SELECT id FROM users')) return { rows: [{ id: 'user-1' }] };
        if (sql.includes('SELECT count(*)::int AS count')) return { rows: [{ count: 0 }] };
        return { rows: [] };
      },
    };
    const service = createWorkspacesService({
      db: {
        async query() { return { rows: [{ count: 0 }] }; },
        async tx(callback) { return callback(transaction); },
      },
      queries: {
        async findPersonalWorkspaceForUser() {
          return { id: 'personal-workspace' };
        },
        async ensureOwnerMembership() {},
        async insertRole() {},
        async insertWorkspace() {
          throw new Error('Workspace must not be created beyond the entitlement limit');
        },
      },
      events: { async publish() {} },
      getBilling: () => ({
        async listEntitlementsForScope() {
          return { 'traderWorkspaces.max': 0 };
        },
      }),
    });

    await assert.rejects(
      service.createSpecializedWorkspace({
        userId: 'user-1',
        type: 'trader',
        name: 'Second trading desk',
      }),
      (error) => {
        assert.equal(error.code, 'WORKSPACE_LIMIT_REACHED');
        assert.deepEqual(error.details, {
          type: 'trader',
          current: 0,
          limit: 0,
          entitlement: 'traderWorkspaces.max',
        });
        return true;
      },
    );
  });
});

describe('workspace capabilities', () => {
  it('reports the workspace type capabilities and authoritative entitlements for an active member', async () => {
    const scopesRead = [];
    const service = createWorkspacesService({
      db: { async query() { return { rows: [] }; } },
      queries: {
        async findWorkspaceById(id) {
          return { id, owner_id: 'owner-1', type: 'developer', status: 'active' };
        },
        async findMembership(workspaceId, userId) {
          assert.equal(workspaceId, 'developer-workspace');
          assert.equal(userId, 'member-1');
          return { status: 'active' };
        },
        async findPersonalWorkspaceForUser(ownerId) {
          assert.equal(ownerId, 'owner-1');
          return { id: 'personal-workspace' };
        },
        async listCapabilityGrantsForWorkspace(workspaceId) {
          assert.equal(workspaceId, 'developer-workspace');
          return [{ capability_key: 'sandbox', enabled: false, source: 'platform_policy' }];
        },
      },
      getBilling: () => ({
        async listEntitlementsForScope(scope) {
          scopesRead.push(scope);
          if (scope.scopeType === 'workspace' && scope.scopeId === 'personal-workspace') {
            return {
              'developerApi.enabled': true,
              'developerWorkspaces.max': 5,
            };
          }
          return {};
        },
      }),
    });

    const result = await service.getWorkspaceCapabilities({
      userId: 'member-1',
      workspaceId: 'developer-workspace',
    });

    assert.equal(result.workspaceType, 'developer');
    assert.deepEqual(
      result.capabilities.map(({ key, enabled, status }) => ({ key, enabled, status })),
      [
        { key: 'applications', enabled: true, status: 'available' },
        { key: 'sandbox', enabled: false, status: 'disabled_by_policy' },
        { key: 'production_api', enabled: true, status: 'available' },
      ],
    );
    assert.ok(scopesRead.some((scope) => scope.scopeId === 'personal-workspace'));
  });

  it('does not return workspace capabilities to a non-member', async () => {
    const service = createWorkspacesService({
      db: { async query() { return { rows: [] }; } },
      queries: {
        async findWorkspaceById(id) {
          return { id, owner_id: 'owner-1', type: 'trader', status: 'active' };
        },
        async findMembership() {
          return null;
        },
      },
    });

    await assert.rejects(
      service.getWorkspaceCapabilities({
        userId: 'other-user',
        workspaceId: 'private-workspace',
      }),
      { code: 'NOT_FOUND' },
    );
  });

  it('blocks invitations when the workspace member entitlement is already full', async () => {
    const service = createWorkspacesService({
      db: {
        async query() { return { rows: [] }; },
        async tx(callback) {
          return callback({
            async query(sql) {
              if (sql.includes('SELECT id FROM workspaces')) return { rows: [{ id: 'trader-workspace' }] };
              throw new Error(`Unexpected query: ${sql}`);
            },
          });
        },
      },
      queries: {
        async findMembership(workspaceId) {
          if (workspaceId === 'trader-workspace') return { status: 'active', role: 'owner' };
          return null;
        },
        async findWorkspaceById(id) {
          return { id, owner_id: 'owner-1', type: 'trader', status: 'active' };
        },
        async findPersonalWorkspaceForUser() {
          return { id: 'personal-workspace' };
        },
        async findPendingInvitationByEmail() {
          return null;
        },
        async countMembersAndPendingInvitations() {
          return 1;
        },
      },
      events: { async publish() {} },
      getBilling: () => ({
        async listEntitlementsForScope() {
          return { 'workspaceMembers.max': 1 };
        },
      }),
    });

    await assert.rejects(
      service.inviteMember({
        actorId: 'owner-1',
        workspaceId: 'trader-workspace',
        email: 'new-member@example.test',
        role: 'viewer',
      }),
      (error) => {
        assert.equal(error.code, 'WORKSPACE_MEMBER_LIMIT_REACHED');
        assert.equal(error.details.limit, 1);
        return true;
      },
    );
  });
});

describe('workspace invitation acceptance', () => {
  function createInvitationService({ accountEmail, memberCount, memberLimit }) {
    const invitation = {
      id: 'invitation-1',
      workspace_id: 'trader-workspace',
      email_normalized: 'member@example.test',
      role: 'viewer',
      invited_by: 'owner-1',
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
    };
    const transaction = {
      async query(sql) {
        if (sql.includes('FROM workspace_invitations')) return { rows: [invitation] };
        if (sql.includes('FROM workspaces')) return { rows: [{ owner_id: 'owner-1' }] };
        if (sql.includes('FROM users')) return { rows: [{ email_normalized: accountEmail }] };
        if (sql.includes('FROM workspace_memberships')) return { rows: [] };
        if (sql.includes('UPDATE workspace_invitations')) return { rows: [] };
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
    const service = createWorkspacesService({
      db: {
        async tx(callback) {
          return callback(transaction);
        },
      },
      queries: {
        async findInvitationByTokenHash() {
          return invitation;
        },
        async findPersonalWorkspaceForUser() {
          return null;
        },
        async countMembersAndPendingInvitations() {
          return memberCount;
        },
        async insertMembership() {},
      },
      events: { async publish() {} },
      getBilling: () => ({
        async listEntitlementsForScope() {
          return { 'workspaceMembers.max': memberLimit };
        },
      }),
    });
    return service;
  }

  it('requires the accepting account email to match the invitation', async () => {
    const service = createInvitationService({
      accountEmail: 'another-account@example.test',
      memberCount: 1,
      memberLimit: 5,
    });

    await assert.rejects(
      service.acceptInvitation({ userId: 'user-2', token: 'invite-token' }),
      { code: 'INVITATION_EMAIL_MISMATCH' },
    );
  });

  it('enforces the member entitlement when accepting an invitation', async () => {
    const service = createInvitationService({
      accountEmail: 'member@example.test',
      memberCount: 2,
      memberLimit: 1,
    });

    await assert.rejects(
      service.acceptInvitation({ userId: 'user-2', token: 'invite-token' }),
      { code: 'WORKSPACE_MEMBER_LIMIT_REACHED' },
    );
  });
});

describe('workspace lifecycle transitions', () => {
  it('locks the latest workspace state before recording a lifecycle transition', async () => {
    const workspace = {
      id: 'trader-workspace',
      owner_id: 'owner-1',
      type: 'trader',
      status: 'active',
    };
    const lifecycleEvents = [];
    const service = createWorkspacesService({
      db: {
        async tx(callback) {
          return callback({
            async query(sql) {
              assert.match(sql, /FOR UPDATE/);
              return { rows: [{ ...workspace }] };
            },
          });
        },
      },
      queries: {
        async setWorkspaceStatus(_workspaceId, status) {
          workspace.status = status;
          return { ...workspace };
        },
        async insertWorkspaceLifecycleEvent(_client, event) {
          lifecycleEvents.push(event);
        },
        async insertWorkspaceAuditEvent() {},
      },
    });

    const result = await service.updateWorkspaceLifecycle({
      userId: 'owner-1',
      workspaceId: 'trader-workspace',
      status: 'paused',
      reason: 'Maintenance',
    });

    assert.equal(result.status, 'paused');
    assert.equal(lifecycleEvents[0].previousStatus, 'active');
    assert.equal(lifecycleEvents[0].nextStatus, 'paused');
  });

  it('rejects a transition that is invalid for the locked state', async () => {
    let statusUpdated = false;
    const service = createWorkspacesService({
      db: {
        async tx(callback) {
          return callback({
            async query() {
              return {
                rows: [{
                  id: 'trader-workspace',
                  owner_id: 'owner-1',
                  type: 'trader',
                  status: 'archived',
                }],
              };
            },
          });
        },
      },
      queries: {
        async findWorkspaceById() {
          return {
            id: 'trader-workspace',
            owner_id: 'owner-1',
            type: 'trader',
            status: 'active',
          };
        },
        async setWorkspaceStatus() {
          statusUpdated = true;
          return null;
        },
      },
    });

    await assert.rejects(
      service.updateWorkspaceLifecycle({
        userId: 'owner-1',
        workspaceId: 'trader-workspace',
        status: 'paused',
      }),
      { message: 'Cannot change workspace status from archived to paused' },
    );
    assert.equal(statusUpdated, false);
  });
});
