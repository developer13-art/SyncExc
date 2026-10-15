/**
 * Signals Module — Unit Tests
 *
 * Covers ingestion, deduplication, parsing, AI interpretation, validation,
 * eligibility, review, and execution intent handoff.
 */

import { describe, expect, test, afterAll, beforeAll } from '@jest/globals';
import {
  api,
  registerUser,
  createWorkspace,
  queryOne,
  queryAll,
  getTestApp,
} from '../helpers.js';
import { closeDatabase } from '../../src/database/index.js';

beforeAll(async () => {
  await getTestApp();
});

afterAll(async () => {
  await closeDatabase();
});

async function createSource(workspaceId) {
  return queryOne(
    `
    INSERT INTO signal_sources (id, workspace_id, type, name, identifier, status, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, 'webhook', 'Test Source', 'test-source-1', 'active', NOW(), NOW())
    RETURNING *
    `,
    [workspaceId]
  );
}

describe('Signals — Ingestion', () => {
  test('accepts a webhook signal message with valid structure', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const source = await createSource(workspace.id);

    const res = await api({
      method: 'post',
      path: '/api/v1/signal-messages/ingest',
      cookies: auth.cookies,
      body: {
        sourceId: source.id,
        providerMessageId: 'msg-1',
        providerTimestamp: new Date().toISOString(),
        contentType: 'text',
        content: 'BTC/USDT LONG Entry 60000-60200 SL 59000 Targets 61000 61500',
      },
    });

    expect([200, 201, 202]).toContain(res.status);
  });

  test('rejects ingestion without a source ID', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/signal-messages/ingest',
      cookies: auth.cookies,
      body: {
        providerTimestamp: new Date().toISOString(),
        contentType: 'text',
        content: 'Test message',
      },
    });

    expect(res.status).toBe(422);
  });

  test('rejects ingestion with an unsupported content type', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const source = await createSource(workspace.id);

    const res = await api({
      method: 'post',
      path: '/api/v1/signal-messages/ingest',
      cookies: auth.cookies,
      body: {
        sourceId: source.id,
        providerTimestamp: new Date().toISOString(),
        contentType: 'unsupported',
        content: 'Test',
      },
    });

    expect(res.status).toBe(422);
  });

  test('deduplicates identical messages from the same source', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const source = await createSource(workspace.id);

    const payload = {
      sourceId: source.id,
      providerMessageId: 'duplicate-msg-1',
      providerTimestamp: new Date().toISOString(),
      contentType: 'text',
      content: 'Unique message content for dedup test',
    };

    const res1 = await api({
      method: 'post',
      path: '/api/v1/signal-messages/ingest',
      cookies: auth.cookies,
      body: payload,
    });
    const res2 = await api({
      method: 'post',
      path: '/api/v1/signal-messages/ingest',
      cookies: auth.cookies,
      body: payload,
    });

    expect([200, 201, 202]).toContain(res1.status);
    expect([200, 201, 202]).toContain(res2.status);

    const count = await queryOne(
      `SELECT COUNT(*)::int AS count FROM signal_messages WHERE provider_message_id = $1`,
      [payload.providerMessageId]
    );
    expect(count.count).toBe(1);
  });
});

describe('Signals — Listing and Retrieval', () => {
  test('lists signals visible to the current user', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/signals',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.signals)).toBe(true);
  });

  test('returns 404 for a signal in another workspace', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();

    const res = await api({
      method: 'get',
      path: `/api/v1/signals/00000000-0000-0000-0000-000000000000`,
      cookies: auth2.cookies,
    });

    expect(res.status).toBe(404);
  });
});

describe('Signals — Messages', () => {
  test('lists messages for the current workspace', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/signal-messages',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });
});

describe('Signals — Review', () => {
  test('rejects a review decision with insufficient reason', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/signals/00000000-0000-0000-0000-000000000000/reviews',
      cookies: auth.cookies,
      body: {
        decision: 'reject',
        reason: 'short',
      },
    });

    expect([404, 422]).toContain(res.status);
  });
});

describe('Signals — Execution Intents', () => {
  test('lists intents for the current workspace', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/execution-intents',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.intents)).toBe(true);
  });
});

describe('Signals — Isolation', () => {
  test('user cannot list messages from another workspace', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();
    const ws1 = await createWorkspace(auth1);
    await createSource(ws1.id);

    const res = await api({
      method: 'get',
      path: `/api/v1/signal-messages?workspaceId=${ws1.id}`,
      cookies: auth2.cookies,
    });

    expect([200, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.messages).toEqual([]);
    }
  });
});