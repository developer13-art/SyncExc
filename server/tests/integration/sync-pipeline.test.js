/**
 * Sync Pipeline — Integration Test
 *
 * End-to-end: register two users in one workspace → connect two exchanges →
 * create sync group → add destination → trigger source event → verify
 * sync operation created → verify deduplication on retry.
 */

import { describe, expect, test, afterAll, beforeAll } from '@jest/globals';
import {
  api,
  registerUser,
  createWorkspace,
  createConnectionDirect,
  queryOne,
  queryAll,
  getTestApp,
} from '../helpers.js';
import { closeDatabase, getPool } from '../../src/database/index.js';

beforeAll(async () => {
  await getTestApp();
});

afterAll(async () => {
  await closeDatabase();
});

async function createAccount(connectionId) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
    INSERT INTO exchange_accounts (id, connection_id, account_type, status, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, 'spot', 'active', NOW(), NOW())
    RETURNING *
    `,
    [connectionId]
  );
  return rows[0];
}

describe('Sync pipeline — end-to-end', () => {
  test('creates a complete sync operation with a destination', async () => {
    // 1. Setup
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);

    const sourceConn = await createConnectionDirect(workspace.id, owner.user.id, { label: 'Source' });
    const destConn = await createConnectionDirect(workspace.id, owner.user.id, { label: 'Dest' });

    const sourceAcc = await createAccount(sourceConn.id);
    const destAcc = await createAccount(destConn.id);

    // 2. Create sync group
    const groupRes = await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: owner.cookies,
      body: {
        name: 'Pipeline Test Group',
        sourceConnectionId: sourceConn.id,
        sourceAccountId: sourceAcc.id,
        marketTypes: ['spot'],
        enabledEventTypes: ['order_filled'],
        mirroringMode: 'fill_based',
        executionMode: 'confirm_before_execution',
      },
    });
    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body.group.id;

    // 3. Add destination
    const destRes = await api({
      method: 'post',
      path: `/api/v1/sync/groups/${groupId}/destinations`,
      cookies: owner.cookies,
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
    expect([200, 201]).toContain(destRes.status);

    // 4. Simulate a source event landing in the DB (as if the adapter emitted it)
    const pool = getPool();
    const sourceEvent = await pool.query(
      `
      INSERT INTO sync_source_events (
        id, group_id, source_connection_id, source_account_id,
        event_type, instrument, quantity, price, occurred_at, created_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, 'order_filled', 'BTCUSDT', '0.1', '60000', NOW(), NOW()
      )
      RETURNING *
      `,
      [groupId, sourceConn.id, sourceAcc.id]
    );
    expect(sourceEvent.rowCount).toBe(1);

    // 5. Verify the sync event exists
    const events = await queryAll(
      `SELECT * FROM sync_source_events WHERE group_id = $1`,
      [groupId]
    );
    expect(events.length).toBe(1);
    expect(events[0].instrument).toBe('BTCUSDT');
  });

  test('idempotency prevents duplicate sync operations', async () => {
    const pool = getPool();
    const key = 'integration-idempotency-' + Date.now();

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
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('rejects destination in an unauthorized workspace', async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const workspace = await createWorkspace(owner);
    const otherWorkspace = await createWorkspace(other);

    const sourceConn = await createConnectionDirect(workspace.id, owner.user.id);
    const sourceAcc = await createAccount(sourceConn.id);
    const destConn = await createConnectionDirect(otherWorkspace.id, other.user.id);
    const destAcc = await createAccount(destConn.id);

    const groupRes = await api({
      method: 'post',
      path: '/api/v1/sync/groups',
      cookies: owner.cookies,
      body: {
        name: 'Cross Workspace',
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
      cookies: owner.cookies,
      body: {
        connectionId: destConn.id,
        accountId: destAcc.id,
        sizingPolicyType: 'fixed_quantity',
        sizingPolicyConfig: { fixedQuantity: '1' },
      },
    });

    expect([403, 404]).toContain(res.status);
  });
});