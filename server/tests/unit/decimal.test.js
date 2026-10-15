import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundDecimal,
  sumDecimals,
  compareDecimals,
  toMinorUnits,
  fromMinorUnits,
} from '@syncexc/shared';

test('roundDecimal rounds to fixed scale', () => {
  assert.equal(roundDecimal('1.2345', 2, 'half_even'), '1.23');
  assert.equal(roundDecimal('1.2355', 2, 'half_even'), '1.24');
  assert.equal(roundDecimal('1.235', 2, 'half_up'), '1.24');
  assert.equal(roundDecimal('1.234', 2, 'round_up'), '1.24');
  assert.equal(roundDecimal('1.239', 2, 'round_down'), '1.23');
});

test('roundDecimal handles negatives', () => {
  assert.equal(roundDecimal('-1.235', 2, 'half_up'), '-1.24');
});

test('sumDecimals sums exactly', () => {
  assert.equal(sumDecimals(['0.1', '0.2']), '0.3');
  assert.equal(sumDecimals(['1.11', '2.22', '3.33']), '6.66');
  assert.equal(sumDecimals([]), '0');
});

test('compareDecimals returns -1, 0, 1', () => {
  assert.equal(compareDecimals('1.5', '1.50'), 0);
  assert.equal(compareDecimals('1.5', '1.51'), -1);
  assert.equal(compareDecimals('1.51', '1.5'), 1);
});

test('toMinorUnits converts to integer', () => {
  assert.equal(toMinorUnits('12.34', 'USD'), 1234n);
  assert.equal(toMinorUnits('100', 'USD'), 10000n);
  assert.equal(toMinorUnits('1.234567', 'USDT'), 1234567n);
});

test('toMinorUnits rejects excess precision', () => {
  assert.throws(() => toMinorUnits('1.234', 'USD'), /exceeds/);
});

test('fromMinorUnits converts back', () => {
  assert.equal(fromMinorUnits(1234n, 'USD'), '12.34');
  assert.equal(fromMinorUnits(10000n, 'USD'), '100.00');
  assert.equal(fromMinorUnits(1234567n, 'USDT'), '1.234567');
});