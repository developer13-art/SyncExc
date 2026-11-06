import test from 'node:test';
import assert from 'node:assert/strict';
import { assertValidSend, createResendTransport } from '../../src/lib/mailer.js';

test('Resend receives the configured sender and both email formats', async () => {
  const requests = [];
  class ResendClient {
    constructor(apiKey) {
      assert.equal(apiKey, 'test-api-key');
      this.emails = {
        send: async (request) => {
          requests.push(request);
          return { data: { id: 'resend-message-id' }, error: null };
        },
      };
    }
  }

  const transport = createResendTransport({
    apiKey: 'test-api-key',
    defaultFrom: 'SyncExc <mail@example.test>',
    ResendClient,
  });
  const result = await transport.send({
    to: 'user@example.test',
    subject: 'Verify your email address',
    html: '<p>Verify</p>',
    text: 'Verify',
  });

  assert.deepEqual(requests, [{
    from: 'SyncExc <mail@example.test>',
    to: 'user@example.test',
    subject: 'Verify your email address',
    html: '<p>Verify</p>',
    text: 'Verify',
  }]);
  assert.deepEqual(result, { messageId: 'resend-message-id', provider: 'resend' });
});

test('Resend rejection and missing message IDs are not reported as accepted', async () => {
  class RejectedResendClient {
    constructor() {
      this.emails = {
        send: async () => ({
          data: null,
          error: { message: 'Sender domain is not verified', statusCode: 403 },
        }),
      };
    }
  }

  const rejected = createResendTransport({
    apiKey: 'test-api-key',
    defaultFrom: 'SyncExc <mail@example.test>',
    ResendClient: RejectedResendClient,
  });
  await assert.rejects(rejected.send({
    to: 'user@example.test',
    subject: 'Verify',
    html: '<p>Verify</p>',
    text: 'Verify',
  }), (error) => error.providerStatus === 403 && error.retryable === false);

  class MissingIdResendClient {
    constructor() {
      this.emails = { send: async () => ({ data: {}, error: null }) };
    }
  }
  const missingId = createResendTransport({
    apiKey: 'test-api-key',
    defaultFrom: 'SyncExc <mail@example.test>',
    ResendClient: MissingIdResendClient,
  });
  await assert.rejects(missingId.send({
    to: 'user@example.test',
    subject: 'Verify',
    html: '<p>Verify</p>',
    text: 'Verify',
  }), { code: 'EMAIL_PROVIDER_INVALID_RESPONSE' });
});

test('mailer rejects invalid recipient and sender addresses before sending', () => {
  assert.throws(() => assertValidSend({
    to: 'user@example.test',
    subject: 'Verify',
  }), { code: 'EMAIL_SENDER_NOT_CONFIGURED' });
  assert.throws(() => assertValidSend({
    to: 'not-an-email',
    from: 'SyncExc <mail@example.test>',
    subject: 'Verify',
  }), { code: 'EMAIL_INVALID_RECIPIENT' });
  assert.throws(() => assertValidSend({
    to: 'user@example.test',
    from: 'invalid sender',
    subject: 'Verify',
  }), { code: 'EMAIL_INVALID_SENDER' });
});