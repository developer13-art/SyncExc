import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailDeliveryRecorder } from '../../src/modules/email/email.recorder.js';

async function attemptSend(error) {
  const updates = [];
  const loggerErrors = [];
  const db = {
    async query(sql) {
      if (sql.includes('INSERT INTO email_deliveries')) {
        return { rows: [{ id: 'delivery-id' }] };
      }
      if (sql.includes('UPDATE email_deliveries')) {
        updates.push(sql);
        return { rows: [] };
      }
      throw new Error('Unexpected query');
    },
  };
  const recorder = createEmailDeliveryRecorder({
    db,
    mailer: {
      provider: 'resend',
      async send() {
        throw error;
      },
    },
    logger: {
      error(fields, message) {
        loggerErrors.push({ fields, message });
      },
    },
  });

  await assert.rejects(recorder.send({
    to: 'user@example.test',
    subject: 'Verify',
    text: 'Verify',
    html: '<p>Verify</p>',
    emailType: 'email_verification',
  }));
  return { updates, loggerErrors };
}

test('email recorder categorizes missing sender configuration', async () => {
  const error = new Error('EMAIL_FROM is required');
  error.code = 'EMAIL_SENDER_NOT_CONFIGURED';
  error.status = 422;
  const { loggerErrors } = await attemptSend(error);
  assert.equal(loggerErrors[0].fields.category, 'configuration');
});

test('email recorder classifies Resend authentication, throttling, and provider errors', async () => {
  for (const [providerStatus, category] of [
    [401, 'auth'],
    [429, 'provider_rate_limited'],
    [503, 'provider_unavailable'],
  ]) {
    const error = new Error('Provider request failed');
    error.providerStatus = providerStatus;
    const { loggerErrors } = await attemptSend(error);
    assert.equal(loggerErrors[0].fields.category, category);
    assert.equal(error.errorCategory, category);
  }
});
