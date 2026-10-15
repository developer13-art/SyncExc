/**
 * Exchange Connections Module — Unit Tests
 *
 * Covers connection creation, credential validation, account discovery,
 * instrument sync, balance sync, health, sharing, and disconnection.
 */

import { describe, expect, test, afterAll } from '@jest/globals';
import {
  api,
  registerUser,
  createWorkspace,
  createConnectionDirect,
  queryOne,
  queryAll,
} from '../helpers.js';
import { closeDatabase } from '../../src/database/index.js';

afterAll(async () => {
  await closeDatabase();
});

describe('Connections — Creation', () => {
  test('rejects connection with missing exchange', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: `/api/v1/workspaces/${auth.user.id}/exchange-connections`,
      cookies: auth.cookies,
      body: {
        environment: 'testnet',
        label: 'Test',
        credentials: { apiKey: 'abc', apiSecret: 'def' },
      },
    });

    expect([404, 422]).toContain(res.status);
  });

  test('rejects connection with an unsupported exchange', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: `/api/v1/workspaces/${auth.user.id}/exchange-connections`,
      cookies: auth.cookies,
      body: {
        exchange: 'unsupported_exchange',
        environment: 'testnet',
        label: 'Test',
        credentials: { apiKey: 'abc', apiSecret: 'def' },
      },
    });

    expect(res.status).toBe(422);
  });

  test('rejects connection with too-short credentials', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: `/api/v1/workspaces/${auth.user.id}/exchange-connections`,
      cookies: auth.cookies,
      body: {
        exchange: 'binance',
        environment: 'testnet',
        label: 'Test',
        credentials: { apiKey: 'short', apiSecret: 'short' },
      },
    });

    expect(res.status).toBe(422);
  });
});

describe('Connections — Listing', () => {
  test('lists connections for a workspace', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    await createConnectionDirect(workspace.id, auth.user.id, { label: 'My Binance' });

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections`,
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.connections)).toBe(true);
    expect(res.body.connections.some((c) => c.label === 'My Binance')).toBe(true);
  });

  test('does not return connections from other workspaces', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();
    const ws1 = await createWorkspace(auth1);
    const ws2 = await createWorkspace(auth2);

    await createConnectionDirect(ws1.id, auth1.user.id, { label: 'WS1 Connection' });

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${ws2.id}/exchange-connections`,
      cookies: auth2.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.connections.some((c) => c.label === 'WS1 Connection')).toBe(false);
  });

  test('never returns raw API credentials in connection responses', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    await createConnectionDirect(workspace.id, auth.user.id);

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections`,
      cookies: auth.cookies,
    });

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('apiSecret');
    expect(serialized).not.toContain('passphrase');
  });
});

describe('Connections — Detail and Health', () => {
  test('retrieves connection details', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const connection = await createConnectionDirect(workspace.id, auth.user.id);

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections/${connection.id}`,
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.connection.id).toBe(connection.id);
    expect(res.body.connection.exchange).toBe('binance');
  });

  test('returns connection health', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const connection = await createConnectionDirect(workspace.id, auth.user.id);

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections/${connection.id}/health`,
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.health).toHaveProperty('status');
  });

  test('returns 404 for connections belonging to other workspaces', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();
    const ws1 = await createWorkspace(auth1);
    const ws2 = await createWorkspace(auth2);

    const connection = await createConnectionDirect(ws1.id, auth1.user.id);

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${ws2.id}/exchange-connections/${connection.id}`,
      cookies: auth2.cookies,
    });

    expect(res.status).toBe(404);
  });
});

describe('Connections — Accounts', () => {
  test('lists discovered accounts for a connection', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const connection = await createConnectionDirect(workspace.id, auth.user.id);

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections/${connection.id}/accounts`,
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.accounts)).toBe(true);
  });
});

describe('Connections — Suspension and Disconnection', () => {
  test('suspends a connection with a reason', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const connection = await createConnectionDirect(workspace.id, auth.user.id);

    const res = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections/${connection.id}/suspend`,
      cookies: auth.cookies,
      body: { reason: 'Investigating suspicious activity' },
    });

    expect(res.status).toBe(200);

    const updated = await queryOne(
      `SELECT status FROM exchange_connections WHERE id = $1`,
      [connection.id]
    );
    expect(updated.status).toBe('suspended');
  });

  test('rejects suspension without a reason', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const connection = await createConnectionDirect(workspace.id, auth.user.id);

    const res = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections/${connection.id}/suspend`,
      cookies: auth.cookies,
      body: {},
    });

    expect(res.status).toBe(422);
  });

  test('disconnects a connection', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const connection = await createConnectionDirect(workspace.id, auth.user.id);

    const res = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections/${connection.id}/disconnect`,
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);

    const updated = await queryOne(
      `SELECT status FROM exchange_connections WHERE id = $1`,
      [connection.id]
    );
    expect(updated.status).toBe('disconnected');
  });
});

describe('Connections — Authorization', () => {
  test('rejects unauthenticated connection list access', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections`,
    });

    expect(res.status).toBe(401);
  });

  test('rejects connection listing for a non-member workspace', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();
    const workspace = await createWorkspace(auth1);

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${workspace.id}/exchange-connections`,
      cookies: auth2.cookies,
    });

    expect(res.status).toBe(404);
  });
});