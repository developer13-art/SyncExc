import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createBillingService } from '../../src/modules/billing/billing.service.js';
import { createBillingQueries } from '../../src/modules/billing/billing.queries.js';
import { ExternalProviderError } from '../../src/lib/errors.js';

describe('billing usage', () => {
  it('combines numeric entitlements with current-period counters', async () => {
    let requestedPeriod;
    const service = createBillingService({
      queries: {
        async listEntitlementsForScope() {
          return [
            { feature_key: 'connections', value: 4 },
            { feature_key: 'advanced_risk', value: true },
          ];
        },
        async listUsageCountersForScope(args) {
          requestedPeriod = args;
          return [{ usage_dimension: 'connections', current_value: '2' }];
        },
      },
    });

    const result = await service.getUsageForScope({
      scopeType: 'user',
      scopeId: 'user-1',
    });

    assert.deepEqual(result.metrics, [
      { key: 'connections', label: 'connections', used: 2, limit: 4 },
    ]);
    assert.equal(requestedPeriod.scopeType, 'user');
    assert.equal(requestedPeriod.scopeId, 'user-1');
    assert.equal(requestedPeriod.periodStart.getUTCDate(), 1);
    assert.equal(requestedPeriod.periodStart.getUTCHours(), 0);
    assert.equal(requestedPeriod.periodEnd.getUTCMonth(), (requestedPeriod.periodStart.getUTCMonth() + 1) % 12);
  });

  it('queries current usage counters for the requested billing scope and period', async () => {
    let sql;
    let params;
    const queries = createBillingQueries({
      db: {
        async query(statement, values) {
          sql = statement;
          params = values;
          return { rows: [{ usage_dimension: 'connections', current_value: '2' }] };
        },
      },
    });
    const start = new Date('2026-10-01T00:00:00.000Z');
    const end = new Date('2026-11-01T00:00:00.000Z');

    const rows = await queries.listUsageCountersForScope({
      scopeType: 'workspace',
      scopeId: 'workspace-1',
      periodStart: start,
      periodEnd: end,
    });

    assert.match(sql, /period_start >= \$3 AND period_start < \$4/);
    assert.deepEqual(params, ['workspace', 'workspace-1', start, end]);
    assert.deepEqual(rows, [{ usage_dimension: 'connections', current_value: '2' }]);
  });

  it('resolves the account email for user and workspace checkout scopes', async () => {
    let sql;
    let params;
    const queries = createBillingQueries({
      db: {
        async query(statement, values) {
          sql = statement;
          params = values;
          return { rows: [{ email: 'buyer@example.com' }] };
        },
      },
    });

    const email = await queries.findCheckoutCustomerEmail('workspace', 'workspace-1');

    assert.equal(email, 'buyer@example.com');
    assert.match(sql, /owner_id FROM workspaces WHERE id = \$2::uuid/);
    assert.deepEqual(params, ['workspace', 'workspace-1']);
  });

  it('marks checkout failed and reports a provider error when initialization fails', async () => {
    const updates = [];
    const service = createBillingService({
      db: { async tx(callback) { return callback({}); } },
      queries: {
        async findPlanPriceById() {
          return { amount_minor: '1200', currency: 'USD' };
        },
        async findCheckoutCustomerEmail() {
          return 'buyer@example.com';
        },
        async insertCheckoutSession() {
          return { id: 'checkout-1' };
        },
        async updateCheckoutSession(id, fields) {
          updates.push({ id, fields });
        },
      },
      providerFactory: {
        get() {
          return {
            async createCheckout() {
              throw new Error('provider rejected configuration');
            },
          };
        },
      },
    });

    await assert.rejects(
      service.createCheckoutSession({
        scopeType: 'user',
        scopeId: 'user-1',
        planPriceId: 'price-1',
        providerName: 'paystack',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
      (error) => error instanceof ExternalProviderError && error.status === 502,
    );
    assert.deepEqual(updates, [{ id: 'checkout-1', fields: { status: 'failed' } }]);
  });
});
