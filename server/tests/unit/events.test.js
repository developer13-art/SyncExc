import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createEnvelopeBuilder } from '../../src/events/envelope.js';
import { createOutbox } from '../../src/events/outbox.js';
import { createPublisher } from '../../src/events/publisher.js';

describe('event envelope and outbox', () => {
  it('reconstructs a valid envelope from nullable database fields', () => {
    const envelope = createEnvelopeBuilder();
    const event = envelope.fromOutboxRow({
      id: '84994b23-4016-4296-9938-2d05cbd8db1b',
      event_type: 'user.session_created',
      schema_version: 'v1',
      payload: { userId: '19a84d4c-a2ec-46a4-a24e-1546d944e99e' },
      correlation_id: 'c6919772-1f74-49ec-8499-ff94f0c63aa4',
      actor_id: '19a84d4c-a2ec-46a4-a24e-1546d944e99e',
      workspace_id: null,
      resource_type: 'user_session',
      resource_id: null,
      occurred_at: new Date('2026-10-15T13:21:35.431Z'),
    });

    const validated = envelope.validate(event);
    assert.equal(validated.eventId, '84994b23-4016-4296-9938-2d05cbd8db1b');
    assert.equal(validated.sourceModule, 'identity');
    assert.equal(validated.workspaceId, null);
    assert.equal(validated.resourceId, validated.eventId);
  });

  it('publishes a valid envelope reconstructed from an outbox row', async () => {
    const envelope = createEnvelopeBuilder();
    const dispatched = [];
    const updates = [];
    const logger = { error() {}, trace() {}, warn() {} };
    const db = {
      async query(sql, params) {
        if (sql.includes('WITH claimed AS')) {
          return {
            rows: [{
              id: '84994b23-4016-4296-9938-2d05cbd8db1b',
              event_type: 'user.session_created',
              schema_version: 'v1',
              payload: { userId: '19a84d4c-a2ec-46a4-a24e-1546d944e99e' },
              correlation_id: 'c6919772-1f74-49ec-8499-ff94f0c63aa4',
              actor_id: '19a84d4c-a2ec-46a4-a24e-1546d944e99e',
              workspace_id: null,
              resource_type: 'user_session',
              resource_id: null,
              occurred_at: new Date('2026-10-15T13:21:35.431Z'),
            }],
          };
        }
        updates.push({ sql, params });
        return { rows: [] };
      },
    };
    const publisher = createPublisher({
      db,
      envelope,
      logger,
      bus: {
        emit(_eventType, event) {
          dispatched.push(event);
        },
      },
      subscribers: { getHandlers: () => [] },
    });

    assert.equal(await publisher.pollOnce(), 1);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].eventId, '84994b23-4016-4296-9938-2d05cbd8db1b');
    assert.equal(dispatched[0].sourceModule, 'identity');
    assert.equal(updates.length, 1);
    assert.match(updates[0].sql, /status = 'published'/);
  });

  it('persists and returns the same event ID', async () => {
    const envelope = createEnvelopeBuilder();
    let queryParameters;
    const outbox = createOutbox({
      envelope,
      db: {},
      logger: { debug() {} },
    });

    const result = await outbox.enqueue(
      {
        async query(_sql, params) {
          queryParameters = params;
        },
      },
      'user.session_created',
      { userId: '19a84d4c-a2ec-46a4-a24e-1546d944e99e' }
    );

    assert.equal(queryParameters[0], result.eventId);
    assert.match(result.eventId, /^[0-9a-f-]{36}$/i);
  });
});
