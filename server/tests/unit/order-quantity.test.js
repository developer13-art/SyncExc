import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeOrderQuantity } from '../../src/lib/order-quantity.js';

test('rounds order quantities down to a valid exchange quantity step', () => {
  assert.equal(normalizeOrderQuantity('12.34567', '0.001'), '12.345');
  assert.equal(normalizeOrderQuantity('0.123456', '0.01'), '0.12');
  assert.equal(normalizeOrderQuantity('1.19', '0.25'), '1');
});

test('preserves quantities already aligned with the exchange step', () => {
  assert.equal(normalizeOrderQuantity('0.25', '0.05'), '0.25');
  assert.equal(normalizeOrderQuantity('3', '1'), '3');
});

test('rejects quantities that become smaller than the step or minimum quantity', () => {
  assert.throws(
    () => normalizeOrderQuantity('0.0004', '0.001'),
    /below the exchange minimum quantity step/,
  );
  assert.throws(
    () => normalizeOrderQuantity('0.012', '0.001', '0.015'),
    /below the exchange minimum quantity/,
  );
});

test('rejects invalid exchange quantity rules', () => {
  assert.throws(() => normalizeOrderQuantity('1.2', '0'), /must be positive/);
  assert.throws(() => normalizeOrderQuantity('1e-3', '0.001'), /rules are invalid/);
});
