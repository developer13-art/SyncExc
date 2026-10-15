import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';

test('hashPassword produces different hashes for same password', async () => {
  const hash1 = await hashPassword('TestPassword123!');
  const hash2 = await hashPassword('TestPassword123!');
  assert.notEqual(hash1, hash2);
});

test('verifyPassword validates correct password', async () => {
  const hash = await hashPassword('TestPassword123!');
  assert.equal(await verifyPassword('TestPassword123!', hash), true);
});

test('verifyPassword rejects wrong password', async () => {
  const hash = await hashPassword('TestPassword123!');
  assert.equal(await verifyPassword('WrongPassword', hash), false);
});

test('verifyPassword handles malformed hash', async () => {
  assert.equal(await verifyPassword('any', 'not-a-hash'), false);
  assert.equal(await verifyPassword('any', ''), false);
});