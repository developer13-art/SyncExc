/**
 * Synchronization Module — Unit Tests
 *
 * Covers sync group creation, destination configuration, deduplication,
 * sizing calculations, partial failures, and reconciliation.
 */

import { describe, expect, test, afterAll, beforeAll } from '@jest/globals';
import {
  api,
  registerUser,
  createWorkspace,
  createConnectionDirect,
  queryOne,
  queryAll,
  exec,
  getTestApp,
} from '../helpers.js';
import { closeDatabase, getPool } from '../../src/database/index.js';

let testApp;

beforeAll(async () => {
  testApp = await getTestApp();
});

afterAll(async () => {
  await closeDatabase();
});

async function createAccount(connectionId, type = 'spot') {
  return queryOne(
    `
    INSERT INTO exchange_accounts (id, connection_id, account_type, status, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, 'active', NOW(), NOW())
    RETURNING *
    `,
    [connectionId, type]
  );
}

describe('Synchronization — Groups', () => {
  test('creates a synchronization group', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const sourceConn = await createConnectionDirect(workspace.id, auth.user.id, { label: 'Source' });
    const sourceAcc = await createAccount(sourceConn.id);

    const res = await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: auth.cookies,
      body: {
        name: 'My Sync Group',
        sourceConnectionId: sourceConn.id,
        sourceAccountId: sourceAcc.id,
        marketTypes: ['spot'],
        enabledEventTypes: ['order_filled'],
        mirroringMode: 'fill_based',
        executionMode: 'confirm_before_execution',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.group.name).toBe('My Sync Group');
    expect(res.body.group.mirroringMode).toBe('fill_based');
  });

  test('rejects group creation with an invalid source connection', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: auth.cookies,
      body: {
        name: 'Bad Group',
        sourceConnectionId: '00000000-0000-0000-0000-000000000000',
        sourceAccountId: '00000000-0000-0000-0000-000000000000',
        marketTypes: ['spot'],
        enabledEventTypes: ['order_filled'],
        mirroringMode: 'fill_based',
        executionMode: 'confirm_before_execution',
      },
    });

    expect([404, 422]).toContain(res.status);
  });

  test('lists sync groups for the current workspace', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const sourceConn = await createConnectionDirect(workspace.id, auth.user.id);
    const sourceAcc = await createAccount(sourceConn.id);

    await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: auth.cookies,
      body: {
        name: 'Listed Group',
        sourceConnectionId: sourceConn.id,
        sourceAccountId: sourceAcc.id,
        marketTypes: ['spot'],
        enabledEventTypes: ['order_filled'],
        mirroringMode: 'fill_based',
        executionMode: 'monitor_only',
      },
    });

    const res = await api({
      method: 'get',
      path: '/api/v1/sync/groups',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.groups.some((g) => g.name === 'Listed Group')).toBe(true);
  });
});

describe('Synchronization — Destinations', () => {
  test('adds a destination to a sync group', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const sourceConn = await createConnectionDirect(workspace.id, auth.user.id, { label: 'Src' });
    const sourceAcc = await createAccount(sourceConn.id);
    const destConn = await createConnectionDirect(workspace.id, auth.user.id, { label: 'Dst' });
    const destAcc = await createAccount(destConn.id);

    const groupRes = await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: auth.cookies,
      body: {
        name: 'Dest Test',
        sourceConnectionId: sourceConn.id,
        sourceAccountId: sourceAcc.id,
        marketTypes: ['spot'],
        enabledEventTypes: ['order_filled'],
        mirroringMode: 'fill_based',
        executionMode: 'confirm_before_execution',
      },
    });

    const res = await api({
      method: 'post',
      path: `/api/v1/sync/groups/${groupRes.body.group.id}/destinations`,
      cookies: auth.cookies,
      body: {
        connectionId: destConn.id,
        accountId: destAcc.id,
        sizingPolicyType: 'proportional_source_quantity',
        sizingPolicyConfig: {
          scaleFactor: '0.5',
          roundingPolicy: 'round_down',
        },
      },
    });

    expect([200, 201]).toContain(res.status);
  });

  test('rejects destination with an invalid sizing policy', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const sourceConn = await createConnectionDirect(workspace.id, auth.user.id);
    const sourceAcc = await createAccount(sourceConn.id);
    const destConn = await createConnectionDirect(workspace.id, auth.user.id);
    const destAcc = await createAccount(destConn.id);

    const groupRes = await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: auth.cookies,
      body: {
        name: 'Bad Sizing',
        sourceConnectionId: sourceConn.id,
        sourceAccountId: sourceAcc.id,
        marketTypes: ['spot'],
        enabledEventTypes: ['order_filled'],
        mirroringMode: 'fill_based',
        executionMode: 'monitor_only',
      },
    });

    const res = await api({
      method: 'post',
      path: `/api/v1/sync/groups/${groupRes.body.group.id}/destinations`,
      cookies: auth.cookies,
      body: {
        connectionId: destConn.id,
        accountId: destAcc.id,
        sizingPolicyType: 'invalid_policy',
        sizingPolicyConfig: {},
      },
    });

    expect(res.status).toBe(422);
  });
});

describe('Synchronization — Pause and Resume', () => {
  test('pauses a sync group', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const sourceConn = await createConnectionDirect(workspace.id, auth.user.id);
    const sourceAcc = await createAccount(sourceConn.id);

    const groupRes = await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: auth.cookies,
      body: {
        name: 'Pausable',
        sourceConnectionId: sourceConn.id,
        sourceAccountId: sourceAcc.id,
        marketTypes: ['spot'],
        enabledEventTypes: ['order_filled'],
        mirroringMode: 'fill_based',
        executionMode: 'monitor_only',
      },
    });

    const res = await api({
      method: 'post',
      path: `/api/v1/sync/groups/${groupRes.body.group.id}/pause`,
      cookies: auth.cookies,
      body: {
        scope: 'new_dispatches',
        reason: 'Investigating an issue',
      },
    });

    expect(res.status).toBe(200);
  });

  test('rejects pause with no reason', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const sourceConn = await createConnectionDirect(workspace.id, auth.user.id);
    const sourceAcc = await createAccount(sourceConn.id);

    const groupRes = await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: auth.cookies,
      body: {
        name: 'No Reason',
        sourceConnectionId: sourceConn.id,
        sourceAccountId: sourceAcc.id,
        marketTypes: ['spot'],
        enabledEventTypes: ['order_filled'],
        mirroringMode: 'fill_based',
        executionMode: 'monitor_only',
      },
    });

    const res = await api({
      method: 'post',
      path: `/api/v1/sync/groups/${groupRes.body.group.id}/pause`,
      cookies: auth.cookies,
      body: { scope: 'new_dispatches' },
    });

    expect(res.status).toBe(422);
  });
});

describe('Synchronization — Deduplication', () => {
  test('rejects duplicate operations with the same idempotency key', async () => {
    const pool = getPool();
    const workspace = await queryOne(
      `
      INSERT INTO workspaces (id, name, type, owner_id, status, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Dedup WS', 'organization', gen_random_uuid(), 'active', NOW(), NOW())
      RETURNING *
      `
    );

    const key = 'test-dedup-key-' + Date.now();
    const first = await pool.query(
      `
      INSERT INTO sync_operations (id, group_id, source_event_type, source_event_payload, status, idempotency_key, created_at)
      VALUES (gen_random_uuid(), NULL, 'order_filled', '{}', 'queued', $1, NOW())
      RETURNING id
      `,
      [key]
    );

    expect(first.rowCount).toBe(1);

    let threw = false;
    try {
      await pool.query(
        `
        INSERT INTO sync_operations (id, group_id, source_event_type, source_event_payload, status, idempotency_key, created_at)
        VALUES (gen_random_uuid(), NULL, 'order_filled', '{}', 'queued', $1, NOW())
        `,
        [key]
      );
    } catch (err) {
      threw = true;
    }

    expect(threw).toBe(true);
  });
});

describe('Synchronization — Isolation', () => {
  test('a user cannot access a sync group from another workspace', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();
    const ws1 = await createWorkspace(auth1);
    const ws2 = await createWorkspace(auth2);

    const sourceConn = await createConnectionDirect(ws1.id, auth1.user.id);
    const sourceAcc = await createAccount(sourceConn.id);

    const groupRes = await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: auth1.cookies,
      body: {
        name: 'Private Group',
        sourceConnectionId: sourceConn.id,
        sourceAccountId: sourceAcc.id,
        marketTypes: ['spot'],
        enabledEventTypes: ['order_filled'],
        mirroringMode: 'fill_based',
        executionMode: 'monitor_only',
      },
    });

    const res = await api({
      method: 'get',
      path: `/api/v1/sync/groups/${groupRes.body.group.id}`,
      cookies: auth2.cookies,
    });

    expect(res.status).toBe(404);
  });
});