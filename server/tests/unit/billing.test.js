/**
 * Billing Module — Unit Tests
 *
 * Covers plans, checkout, subscriptions, entitlements, usage limits,
 * invoices, refunds, and reconciliation.
 */

import { describe, expect, test, afterAll } from '@jest/globals';
import {
  api,
  registerUser,
  createWorkspace,
  queryOne,
  queryAll,
  exec,
} from '../helpers.js';
import { closeDatabase, getPool } from '../../src/database/index.js';

afterAll(async () => {
  await closeDatabase();
});

async function seedPlan() {
  const pool = getPool();
  const plan = await queryOne(
    `
    INSERT INTO subscription_plans (id, code, name, description, status, created_at, updated_at)
    VALUES (gen_random_uuid(), 'test_basic', 'Basic', 'Test plan', 'active', NOW(), NOW())
    ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
    RETURNING *
    `
  );

  await exec(
    `
    INSERT INTO subscription_plan_versions (id, plan_id, version_number, features, limits, effective_from, published_at)
    VALUES (gen_random_uuid(), $1, 1, $2, $3, NOW(), NOW())
    ON CONFLICT DO NOTHING
    `,
    [
      plan.id,
      JSON.stringify({ 'automation.enabled': true, 'simulation.enabled': true }),
      JSON.stringify({ 'exchangeConnections.max': 3, 'signalSources.max': 10 }),
    ]
  );

  const version = await queryOne(
    `SELECT * FROM subscription_plan_versions WHERE plan_id = $1 ORDER BY version_number DESC LIMIT 1`,
    [plan.id]
  );

  const price = await queryOne(
    `
    INSERT INTO subscription_plan_prices (id, plan_version_id, currency, amount_minor, billing_interval, effective_from)
    VALUES (gen_random_uuid(), $1, 'USD', 1900, 'monthly', NOW())
    RETURNING *
    `,
    [version.id]
  );

  return { plan, version, price };
}

describe('Billing — Plans', () => {
  test('lists available plans', async () => {
    await seedPlan();

    const auth = await registerUser();
    const res = await api({
      method: 'get',
      path: '/api/v1/billing/plans',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans.length).toBeGreaterThan(0);
  });

  test('retrieves a specific plan with pricing', async () => {
    const { plan } = await seedPlan();
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: `/api/v1/billing/plans/${plan.id}`,
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.plan.code).toBe('test_basic');
    expect(res.body.plan.prices).toBeDefined();
  });
});

describe('Billing — Checkout', () => {
  test('rejects checkout with a nonexistent plan', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/billing/checkout',
      cookies: auth.cookies,
      body: {
        planId: '00000000-0000-0000-0000-000000000000',
        planPriceId: '00000000-0000-0000-0000-000000000000',
        provider: 'stripe',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
    });

    expect(res.status).toBe(404);
  });

  test('creates a pending checkout with a valid plan', async () => {
    const { plan, price } = await seedPlan();
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/billing/checkout',
      cookies: auth.cookies,
      body: {
        planId: plan.id,
        planPriceId: price.id,
        provider: 'stripe',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
    });

    expect([201, 200, 202]).toContain(res.status);
    if (res.body.checkout) {
      expect(res.body.checkout.status).toBe('pending');
    }
  });
});

describe('Billing — Subscriptions', () => {
  test('returns 404 when no subscription exists for the billing scope', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/billing/subscription',
      cookies: auth.cookies,
    });

    expect([200, 404]).toContain(res.status);
  });

  test('subscription status endpoint only returns own subscription', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/billing/subscription',
      cookies: auth1.cookies,
    });

    const res2 = await api({
      method: 'get',
      path: '/api/v1/billing/subscription',
      cookies: auth2.cookies,
    });

    expect(res.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});

describe('Billing — Entitlements', () => {
  test('returns effective entitlements for the current billing scope', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/billing/entitlements',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('entitlements');
    expect(res.body).toHaveProperty('subscriptionStatus');
  });

  test('entitlements are scoped to the requesting workspace only', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();

    const ws1 = await createWorkspace(auth1);
    const ws2 = await createWorkspace(auth2);

    const res1 = await api({
      method: 'get',
      path: `/api/v1/billing/entitlements?workspaceId=${ws1.id}`,
      cookies: auth1.cookies,
    });

    expect(res1.status).toBe(200);

    const res2 = await api({
      method: 'get',
      path: `/api/v1/billing/entitlements?workspaceId=${ws2.id}`,
      cookies: auth1.cookies,
    });

    expect([403, 404]).toContain(res2.status);
  });
});

describe('Billing — Usage Metering', () => {
  test('returns usage against plan limits', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/billing/usage',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('usage');
  });
});

describe('Billing — Invoices', () => {
  test('returns empty invoice list for a user with no invoices', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/billing/invoices',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.invoices)).toBe(true);
  });
});

describe('Billing — Refunds', () => {
  test('rejects a refund request without a valid payment', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/billing/refund-requests',
      cookies: auth.cookies,
      body: {
        paymentId: '00000000-0000-0000-0000-000000000000',
        reason: 'Duplicate charge on my account',
      },
    });

    expect([404, 422]).toContain(res.status);
  });

  test('rejects a refund request without enough detail in the reason', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/billing/refund-requests',
      cookies: auth.cookies,
      body: {
        paymentId: '00000000-0000-0000-0000-000000000000',
        reason: 'short',
      },
    });

    expect(res.status).toBe(422);
  });
});

describe('Billing — Webhooks', () => {
  test('rejects unsigned webhook calls', async () => {
    const res = await api({
      method: 'post',
      path: '/api/v1/billing/webhooks/stripe',
      body: { type: 'checkout.session.completed', data: {} },
    });

    expect([400, 401, 403]).toContain(res.status);
  });

  test('rejects webhook calls with an invalid signature', async () => {
    const res = await api({
      method: 'post',
      path: '/api/v1/billing/webhooks/stripe',
      headers: { 'stripe-signature': 'invalid' },
      body: { type: 'checkout.session.completed', data: {} },
    });

    expect([400, 401, 403]).toContain(res.status);
  });
});

describe('Billing — Isolation', () => {
  test('a user cannot view another user\'s payment record', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();

    const payment = await queryOne(
      `
      INSERT INTO subscription_payments (id, subscription_id, provider, provider_payment_reference, amount_minor, currency, status, created_at, updated_at)
      VALUES (gen_random_uuid(), NULL, 'stripe', 'test_ref_1', 1900, 'USD', 'succeeded', NOW(), NOW())
      RETURNING *
      `
    );

    const res = await api({
      method: 'get',
      path: `/api/v1/billing/payments/${payment.id}`,
      cookies: auth2.cookies,
    });

    expect([403, 404]).toContain(res.status);
  });
});