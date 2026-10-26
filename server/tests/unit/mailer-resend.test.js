import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createResendMailer } from '../../src/lib/mailer.js';

test('sends email through Resend using the configured sender', async () => {
  let request;
  const mailer = createResendMailer({
    apiKey: 'resend-test-key',
    fromEmail: 'noreply@noreply.syncexc.com',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return { id: 'email-123' };
        },
      };
    },
  });

  const result = await mailer.send({
    to: 'user@example.com',
    subject: 'Verify your SyncExc account',
    text: 'Verify your account',
    html: '<p>Verify your account</p>',
  });

  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer resend-test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    from: 'SyncExc <noreply@noreply.syncexc.com>',
    to: ['user@example.com'],
    subject: 'Verify your SyncExc account',
    html: '<p>Verify your account</p>',
    text: 'Verify your account',
  });
  assert.equal(result.messageId, 'email-123');
  assert.deepEqual(result.accepted, ['user@example.com']);
});

test('surfaces failed Resend delivery without exposing provider response details', async () => {
  const mailer = createResendMailer({
    apiKey: 'resend-test-key',
    fromEmail: 'noreply@noreply.syncexc.com',
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        return { message: 'Unauthorized' };
      },
    }),
  });

  await assert.rejects(
    mailer.send({
      to: 'user@example.com',
      subject: 'Verify your account',
      text: 'Verify your account',
    }),
    (error) => {
      assert.equal(error.code, 'EXTERNAL_PROVIDER_ERROR');
      assert.equal(error.status, 502);
      assert.equal(error.message, 'Email delivery failed. Please try again later.');
      assert.equal(error.details.provider, 'resend');
      return true;
    },
  );
});
