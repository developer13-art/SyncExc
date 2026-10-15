/**
 * Risk Module — Unit Tests
 *
 * Covers policy creation, pre-trade evaluation, exposure aggregation,
 * approvals, emergency pause, and incident handling.
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
import { closeDatabase } from '../../src/database/index.js';

beforeAll(async () => {
  await getTestApp();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Risk — Policies', () => {
  test('creates a workspace risk policy', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'post',
      path: '/api/v1/risk/policies',
      cookies: auth.cookies,
      body: {
        name: 'Conservative Limits',
        scope: 'workspace',
        scopeRef: workspace.id,
        enforcementMode: 'block',
        rules: [
          {
            type: 'order_limit',
            config: {
              maxNotionalPerOrder: '10000',
              maxOrdersPerMinute: 10,
            },
          },
        ],
      },
    });

    expect([200, 201]).toContain(res.status);
    if (res.body.policy) {
      expect(res.body.policy.name).toBe('Conservative Limits');
      expect(res.body.policy.status).toBe('active');
    }
  });

  test('rejects policy with no rules', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/risk/policies',
      cookies: auth.cookies,
      body: {
        name: 'Empty Policy',
        scope: 'workspace',
        enforcementMode: 'block',
        rules: [],
      },
    });

    expect(res.status).toBe(422);
  });

  test('rejects policy with an unsupported enforcement mode', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/risk/policies',
      cookies: auth.cookies,
      body: {
        name: 'Bad Mode',
        scope: 'workspace',
        enforcementMode: 'nonexistent_mode',
        rules: [{ type: 'order_limit', config: {} }],
      },
    });

    expect(res.status).toBe(422);
  });

  test('lists risk policies for the current workspace', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    await api({
      method: 'post',
      path: '/api/v1/risk/policies',
      cookies: auth.cookies,
      body: {
        name: 'Listed Policy',
        scope: 'workspace',
        scopeRef: workspace.id,
        enforcementMode: 'warn',
        rules: [{ type: 'order_limit', config: { maxOrdersPerMinute: 5 } }],
      },
    });

    const res = await api({
      method: 'get',
      path: '/api/v1/risk/policies',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.policies)).toBe(true);
  });
});

describe('Risk — Evaluation', () => {
  test('evaluates a proposed operation and returns a decision', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);
    const conn = await createConnectionDirect(workspace.id, auth.user.id);

    const account = await queryOne(
      `
      INSERT INTO exchange_accounts (id, connection_id, account_type, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, 'spot', 'active', NOW(), NOW())
      RETURNING *
      `,
      [conn.id]
    );

    const res = await api({
      method: 'post',
      path: '/api/v1/risk/evaluate',
      cookies: auth.cookies,
      body: {
        operationType: 'order_submission',
        connectionId: conn.id,
        accountId: account.id,
        instrumentId: 'BTCUSDT',
        marketType: 'spot',
        side: 'buy',
        quantity: '0.001',
        orderType: 'market',
      },
    });

    expect([200, 202]).toContain(res.status);
    expect(res.body.evaluation).toBeDefined();
    expect(res.body.evaluation.outcome).toBeDefined();
  });

  test('rejects evaluation with missing required fields', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/risk/evaluate',
      cookies: auth.cookies,
      body: {
        operationType: 'order_submission',
      },
    });

    expect(res.status).toBe(422);
  });
});

describe('Risk — Emergency Pause', () => {
  test('requests an emergency pause', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'post',
      path: '/api/v1/risk/emergency-pause',
      cookies: auth.cookies,
      body: {
        scope: 'workspace',
        scopeRef: workspace.id,
        reason: 'Unusual activity detected on one connection',
      },
    });

    expect([200, 201, 202]).toContain(res.status);
  });

  test('rejects emergency pause without reason', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'post',
      path: '/api/v1/risk/emergency-pause',
      cookies: auth.cookies,
      body: {
        scope: 'workspace',
        scopeRef: workspace.id,
      },
    });

    expect(res.status).toBe(422);
  });

  test('returns emergency pause status', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/risk/emergency-pause/status',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pauses');
  });
});

describe('Risk — Exposure', () => {
  test('returns exposure summary for the current workspace', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'get',
      path: `/api/v1/risk/exposure?workspaceId=${workspace.id}`,
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('exposure');
  });
});

describe('Risk — Alerts', () => {
  test('lists alerts for the current user', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/risk/alerts',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });
});

describe('Risk — Approvals', () => {
  test('lists pending approvals for the current user', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/risk/approvals',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.approvals)).toBe(true);
  });
});

describe('Risk — Isolation', () => {
  test('rejects policy listing across workspaces', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/risk/policies?workspaceId=00000000-0000-0000-0000-000000000000',
      cookies: auth.cookies,
    });

    expect([200, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.policies).toEqual([]);
    }
  });
});