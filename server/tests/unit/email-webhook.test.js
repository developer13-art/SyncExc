import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailService } from '../../src/modules/email/email.service.js';

function createService({ duplicate = false } = {}) {
  const updates = [];
  const recordedEvents = [];
  const service = createEmailService({
    db: { tx: async (callback) => callback({}) },
    queries: {
      insertWebhookEvent: async (_tx, event) => {
        recordedEvents.push(event);
        return !duplicate;
      },
      updateDeliveryByMessageId: async (_db, messageId, fields) => {
        updates.push({ messageId, fields });
      },
    },
    logger: { debug() {}, warn() {}, error() {} },
  });
  return { service, updates, recordedEvents };
}

test('Resend delivery webhooks update accepted delivery state', async () => {
  const { service, updates, recordedEvents } = createService();
  const result = await service.handleWebhookEvent({
    id: 'evt-delivered',
    type: 'email.delivered',
    data: { email_id: 'resend-message-id' },
  });

  assert.deepEqual(result, { duplicate: false, status: 'delivered' });
  assert.equal(recordedEvents[0].provider, 'resend');
  assert.deepEqual(updates, [{
    messageId: 'resend-message-id',
    fields: { deliveryStatus: 'delivered' },
  }]);
});

test('duplicate events are recorded once and do not replay delivery updates', async () => {
  const { service, updates } = createService({ duplicate: true });
  const result = await service.handleWebhookEvent({
    id: 'evt-duplicate',
    type: 'email.bounced',
    data: { email_id: 'resend-message-id' },
  });

  assert.deepEqual(result, { duplicate: true });
  assert.equal(updates.length, 0);
});

test('provider failures persist bounded diagnostic details', async () => {
  const { service, updates } = createService();
  const result = await service.handleWebhookEvent({
    id: 'evt-failed',
    type: 'email.failed',
    data: {
      email_id: 'resend-message-id',
      error_category: 'invalid_recipient',
      error_message: 'Recipient rejected',
    },
  });

  assert.deepEqual(result, { duplicate: false, status: 'failed' });
  assert.deepEqual(updates[0].fields, {
    deliveryStatus: 'failed',
    errorCategory: 'invalid_recipient',
    failureReason: 'Recipient rejected',
  });
});
