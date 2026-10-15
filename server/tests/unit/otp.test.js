import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateNumericCode,
  hashCode,
  generateSalt,
} from '../../src/lib/otp.js';

test('generateNumericCode produces correct length', () => {
  assert.equal(generateNumericCode(6).length, 6);
  assert.equal(generateNumericCode(4).length, 4);
});

test('generateNumericCode contains only digits', () => {
  const code = generateNumericCode(10);
  assert.match(code, /^[0-9]{10}$/);
});

test('generateSalt produces unique salts', () => {
  const a = generateSalt();
  const b = generateSalt();
  assert.notEqual(a, b);
  assert.equal(a.length, 32);
});

test('hashCode produces deterministic output with same salt', () => {
  const salt = 'test_salt';
  const a = hashCode('123456', salt);
  const b = hashCode('123456', salt);
  assert.equal(a, b);
});

test('hashCode produces different output with different salt', () => {
  const a = hashCode('123456', 'salt1');
  const b = hashCode('123456', 'salt2');
  assert.notEqual(a, b);
});