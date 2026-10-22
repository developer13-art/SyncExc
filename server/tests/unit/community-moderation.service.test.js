import test from 'node:test';
import assert from 'node:assert/strict';

import { createModerationService } from '../../src/modules/community/moderation.js';

function createService({ updateResult = { id: 'case-1', state: 'resolved' } } = {}) {
  const calls = { actions: [], audits: [], events: [], caseUpdates: [] };
  const tx = { query: async () => ({ rows: [], rowCount: 1 }) };
  const service = createModerationService({
    db: {
      query: async () => ({ rows: [{ owner_id: 'owner-1' }] }),
      tx: (callback) => callback(tx),
    },
    queries: {
      findModerationCaseById: async () => ({
        id: 'case-1',
        resource_type: 'post',
        resource_id: 'post-1',
        state: 'pending',
      }),
      updateModerationCase: async (...args) => {
        calls.caseUpdates.push(args);
        return updateResult;
      },
      insertModerationAction: async (...args) => calls.actions.push(args),
      insertAuditEvent: async (...args) => calls.audits.push(args),
    },
    events: { publish: async (...args) => calls.events.push(args) },
  });
  return { service, calls, tx };
}

test('moderation decisions update the case and record an audit event atomically', async () => {
  const { service, calls, tx } = createService();

  await service.decide({
    caseId: 'case-1',
    actorId: 'moderator-1',
    action: 'add_warning',
    reason: 'The post violates the community rules.',
    notes: 'Warned the author.',
  });

  assert.equal(calls.caseUpdates[0][2], tx);
  assert.deepEqual(calls.caseUpdates[0][3], ['pending', 'under_review', 'escalated']);
  assert.equal(calls.actions.length, 1);
  assert.equal(calls.audits[0][1].action, 'moderation.add_warning');
  assert.equal(calls.events[0][2].userId, 'owner-1');
});

test('a moderation case cannot be decided twice', async () => {
  const { service, calls } = createService({ updateResult: null });

  await assert.rejects(
    service.decide({
      caseId: 'case-1',
      actorId: 'moderator-1',
      action: 'dismiss',
      reason: 'The report does not describe a policy violation.',
    }),
    /already been decided/
  );
  assert.equal(calls.actions.length, 0);
});
