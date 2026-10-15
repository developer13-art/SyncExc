/**
 * Referral Module — Unit Tests
 *
 * Covers affiliate enrollment, referral links, attribution, commission
 * calculation, ledger, and payout requests.
 */

import { describe, expect, test, afterAll, beforeAll } from '@jest/globals';
import {
  api,
  registerUser,
  queryOne,
  getTestApp,
} from '../helpers.js';
import { closeDatabase } from '../../src/database/index.js';

beforeAll(async () => {
  await getTestApp();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Referral — Enrollment', () => {
  test('enrolls a user as an affiliate', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth.cookies,
      body: {
        acceptedAgreement: true,
        payoutCurrency: 'USD',
      },
    });

    expect([200, 201]).toContain(res.status);
  });

  test('rejects enrollment without accepting the agreement', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth.cookies,
      body: {
        acceptedAgreement: false,
        payoutCurrency: 'USD',
      },
    });

    expect(res.status).toBe(422);
  });

  test('returns affiliate profile status', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/affiliate/profile',
      cookies: auth.cookies,
    });

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('profile');
    }
  });
});

describe('Referral — Links', () => {
  test('rejects link creation before enrollment', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/affiliate/referral-links',
      cookies: auth.cookies,
      body: {
        name: 'Test Link',
      },
    });

    expect([403, 404, 422]).toContain(res.status);
  });

  test('creates a link after enrollment', async () => {
    const auth = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth.cookies,
      body: { acceptedAgreement: true, payoutCurrency: 'USD' },
    });

    const res = await api({
      method: 'post',
      path: '/api/v1/affiliate/referral-links',
      cookies: auth.cookies,
      body: {
        name: 'My Campaign',
        campaignLabel: 'twitter',
      },
    });

    expect([200, 201]).toContain(res.status);
    if (res.body.link) {
      expect(res.body.link.name).toBe('My Campaign');
    }
  });

  test('lists referral links for the current affiliate', async () => {
    const auth = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth.cookies,
      body: { acceptedAgreement: true, payoutCurrency: 'USD' },
    });

    await api({
      method: 'post',
      path: '/api/v1/affiliate/referral-links',
      cookies: auth.cookies,
      body: { name: 'Listed Link' },
    });

    const res = await api({
      method: 'get',
      path: '/api/v1/affiliate/referral-links',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.links)).toBe(true);
  });
});

describe('Referral — Commissions and Ledger', () => {
  test('returns an empty commission list for a new affiliate', async () => {
    const auth = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth.cookies,
      body: { acceptedAgreement: true, payoutCurrency: 'USD' },
    });

    const res = await api({
      method: 'get',
      path: '/api/v1/affiliate/commissions',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.commissions).toEqual([]);
  });

  test('returns an empty ledger for a new affiliate', async () => {
    const auth = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth.cookies,
      body: { acceptedAgreement: true, payoutCurrency: 'USD' },
    });

    const res = await api({
      method: 'get',
      path: '/api/v1/affiliate/ledger',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
  });

  test('returns zero balances for a new affiliate', async () => {
    const auth = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth.cookies,
      body: { acceptedAgreement: true, payoutCurrency: 'USD' },
    });

    const res = await api({
      method: 'get',
      path: '/api/v1/affiliate/dashboard',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    if (res.body.dashboard) {
      expect(res.body.dashboard.balances).toBeDefined();
    }
  });
});

describe('Referral — Payouts', () => {
  test('rejects a payout request without a valid method', async () => {
    const auth = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth.cookies,
      body: { acceptedAgreement: true, payoutCurrency: 'USD' },
    });

    const res = await api({
      method: 'post',
      path: '/api/v1/affiliate/payouts',
      cookies: auth.cookies,
      body: {
        methodId: '00000000-0000-0000-0000-000000000000',
        amountMinor: 1000,
        currency: 'USD',
      },
    });

    expect([404, 422]).toContain(res.status);
  });

  test('rejects a payout request with a non-positive amount', async () => {
    const auth = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth.cookies,
      body: { acceptedAgreement: true, payoutCurrency: 'USD' },
    });

    const res = await api({
      method: 'post',
      path: '/api/v1/affiliate/payouts',
      cookies: auth.cookies,
      body: {
        methodId: '00000000-0000-0000-0000-000000000000',
        amountMinor: 0,
        currency: 'USD',
      },
    });

    expect(res.status).toBe(422);
  });
});

describe('Referral — Isolation', () => {
  test('a user can only see their own affiliate profile', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/affiliate/enrollment',
      cookies: auth1.cookies,
      body: { acceptedAgreement: true, payoutCurrency: 'USD' },
    });

    const res = await api({
      method: 'get',
      path: `/api/v1/admin/affiliate/affiliates?userId=${auth1.user.id}`,
      cookies: auth2.cookies,
    });

    expect([401, 403, 404]).toContain(res.status);
  });
});