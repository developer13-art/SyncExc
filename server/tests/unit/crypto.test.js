import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encrypt,
  decrypt,
  sha256,
  hmacSha256,
  timingSafeEqual,
  randomToken,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../../src/lib/crypto.js';

process.env.ENCRYPTION_MASTER_KEY =
  process.env.ENCRYPTION_MASTER_KEY || Buffer.alloc(32).toString('base64');

test('encrypt/decrypt round trip', () => {
  const plaintext = 'secret data 123 !@#';
  const ciphertext = encrypt(plaintext);
  assert.notEqual(ciphertext, plaintext);
  assert.match(ciphertext, /^v1\./);
  assert.equal(decrypt(ciphertext), plaintext);
});

test('decrypt fails on tampered ciphertext', () => {
  const ciphertext = encrypt('hello');
  const tampered = ciphertext.slice(0, -4) + 'XXXX';
  assert.throws(() => decrypt(tampered));
});

test('sha256 produces stable hex output', () => {
  const hash = sha256('test');
  assert.equal(hash.length, 64);
  assert.equal(sha256('test'), hash);
  assert.notEqual(sha256('test2'), hash);
});

test('hmacSha256 produces deterministic output', () => {
  const mac = hmacSha256('message', 'secret');
  assert.equal(mac.length, 64);
  assert.equal(hmacSha256('message', 'secret'), mac);
});

test('timingSafeEqual works correctly', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true);
  assert.equal(timingSafeEqual('abc', 'abd'), false);
  assert.equal(timingSafeEqual('abc', 'abcd'), false);
});

test('randomToken produces unique tokens', () => {
  const a = randomToken(16);
  const b = randomToken(16);
  assert.notEqual(a, b);
  assert.ok(a.length > 10);
});

test('signWebhookPayload and verifyWebhookSignature round trip', () => {
  const payload = { event: 'test' };
  const secret = 'whsec_test';
  const { signature, timestamp } = signWebhookPayload(payload, secret);

  assert.equal(
    verifyWebhookSignature({
      payload,
      signature,
      secret,
      timestamp,
    }),
    true
  );

  // Wrong secret fails
  assert.equal(
    verifyWebhookSignature({
      payload,
      signature,
      secret: 'wrong',
      timestamp,
    }),
    false
  );

  // Old timestamp fails
  assert.equal(
    verifyWebhookSignature({
      payload,
      signature,
      secret,
      timestamp: timestamp - 1000,
    }),
    false
  );
});