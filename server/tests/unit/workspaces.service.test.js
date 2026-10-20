import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createWorkspacesService } from '../../src/modules/workspaces/workspaces.service.js';

function createService() {
  const transaction = {
    async query() {
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
});
