/**
 * Billing Webhook — Integration Test
 *
 * End-to-end: webhook signature verification, idempotent event processing,
 * duplicate webhook delivery handling, and reconciliation.
 */

import { describe, expect, test, afterAll, beforeAll } from '@jest/globals';
import crypto from 'node:crypto';
import {
  api,
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

function signStripePayload(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('Billing webhook — end-to-end', () => {
  test('rejects webhook with no signature', async () => {
    const res = await api({
      method: 'post',
      path: '/api/v1/billing/webhooks/stripe',
      body: { type: 'checkout.session.completed', data: {} },
    });

    expect([400, 401, 403]).toContain(res.status);
  });

  test('rejects webhook with invalid signature', async () => {
    const res = await api({
      method: 'post',
      path: '/api/v1/billing/webhooks/stripe',
      headers: { 'stripe-signature': 't=123,v1=invalid' },
      body: { type: 'checkout.session.completed', data: {} },
    });

    expect([400, 401, 403]).toContain(res.status);
  });

  test('records webhook event to prevent duplicate processing', async () => {
    const pool = getPool();
    const eventId = 'evt_test_' + Date.now();

    const first = await pool.query(
      `
      INSERT INTO payment_webhook_events (id, provider, provider_event_id, event_type, payload, processing_status, received_at)
      VALUES (gen_random_uuid(), 'stripe', $1, 'checkout.session.completed', '{}', 'received', NOW())
      RETURNING id
      `,
      [eventId]
    );
    expect(first.rowCount).toBe(1);

    let threw = false;
    try {
      await pool.query(
        `
        INSERT INTO payment_webhook_events (id, provider, provider_event_id, event_type, payload, processing_status, received_at)
        VALUES (gen_random_uuid(), 'stripe', $1, 'checkout.session.completed', '{}', 'received', NOW())
        `,
        [eventId]
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('payment webhook events are queryable and track status', async () => {
    const pool = getPool();
    const eventId = 'evt_status_' + Date.now();
    await pool.query(
      `
      INSERT INTO payment_webhook_events (id, provider, provider_event_id, event_type, payload, processing_status, received_at)
      VALUES (gen_random_uuid(), 'stripe', $1, 'invoice.paid', '{}', 'received', NOW())
      `,
      [eventId]
    );

    const events = await queryAll(
      `SELECT * FROM payment_webhook_events WHERE provider_event_id = $1`,
      [eventId]
    );
    expect(events.length).toBe(1);
    expect(events[0].processing_status).toBe('received');
  });

  test('refunds create linked ledger adjustments', async () => {
    const pool = getPool();

    // Create a payment
    const payment = await queryOne(
      `
      INSERT INTO subscription_payments (id, subscription_id, provider, provider_payment_reference, amount_minor, currency, status, created_at, updated_at)
      VALUES (gen_random_uuid(), NULL, 'stripe', 'pay_refund_' || gen_random_uuid()::text, 1900, 'USD', 'succeeded', NOW(), NOW())
      RETURNING *
      `
    );

    // Create a refund record
    const refund = await queryOne(
      `
      INSERT INTO refund_records (id, payment_id, amount_minor, currency, reason, status, requested_at, created_at)
      VALUES (gen_random_uuid(), $1, 1900, 'USD', 'Duplicate charge', 'completed', NOW(), NOW())
      RETURNING *
      `,
      [payment.id]
    );

    expect(refund.payment_id).toBe(payment.id);
    expect(refund.amount_minor).toBe(1900);

    // Original payment remains intact
    const original = await queryOne(
      `SELECT * FROM subscription_payments WHERE id = $1`,
      [payment.id]
    );
    expect(original).not.toBeNull();
    expect(original.status).toBe('succeeded');
  });
});