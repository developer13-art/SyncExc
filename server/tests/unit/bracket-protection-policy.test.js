import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBracketProtectionPlan } from '../../src/modules/connections/bracket-protection.policy.js';

const bybitCapabilities = {
  bracketProtection: {
    spot: {
      nativePositionOrderTypes: [],
      entryAttachedConditionalOrderTypes: ['limit'],
      postFillConditionalOrderTypes: [],
    },
    futures: {
      nativePositionOrderTypes: ['market', 'limit'],
      entryAttachedConditionalOrderTypes: [],
      postFillConditionalOrderTypes: [],
    },
  },
};

test('allows Futures/Perpetuals native TP/SL only for explicitly declared order types', () => {
  for (const orderType of ['market', 'limit']) {
    const plan = resolveBracketProtectionPlan({
      capabilities: bybitCapabilities,
      marketType: 'futures',
      orderType,
      stopLoss: '90',
      takeProfit: '110',
    });
    assert.equal(plan.supported, true);
    assert.equal(plan.strategy, 'native_position');
  }

  const perpetualPlan = resolveBracketProtectionPlan({
    capabilities: bybitCapabilities,
    marketType: 'perpetual',
    orderType: 'market',
    stopLoss: '90',
    takeProfit: '110',
  });
  assert.equal(perpetualPlan.marketType, 'futures');
  assert.equal(perpetualPlan.supported, true);
});

test('allows only the exchange-declared Spot Limit entry-attached TP/SL combination', () => {
  const plan = resolveBracketProtectionPlan({
    capabilities: bybitCapabilities,
    marketType: 'spot',
    orderType: 'limit',
    stopLoss: '90',
    takeProfit: '110',
  });
  assert.equal(plan.supported, true);
  assert.equal(plan.strategy, 'entry_attached_conditional');
});

test('rejects Spot Market TP/SL without silently rewriting or stripping protection', () => {
  const plan = resolveBracketProtectionPlan({
    capabilities: bybitCapabilities,
    marketType: 'spot',
    orderType: 'market',
    stopLoss: '90',
    takeProfit: '110',
  });
  assert.equal(plan.supported, false);
  assert.equal(plan.code, 'TP_SL_PROTECTION_UNSUPPORTED');
  assert.match(plan.warning, /Post-fill trigger emulation is not enabled/);
  assert.match(plan.warning, /No order was submitted/);
});

test('does not claim support for post-fill trigger emulation until a coordinator exists', () => {
  const plan = resolveBracketProtectionPlan({
    capabilities: {
      bracketProtection: {
        spot: {
          nativePositionOrderTypes: [],
          entryAttachedConditionalOrderTypes: [],
          postFillConditionalOrderTypes: ['market'],
        },
      },
    },
    marketType: 'spot',
    orderType: 'market',
    stopLoss: '90',
    takeProfit: '110',
  });
  assert.equal(plan.supported, false);
  assert.equal(plan.code, 'TP_SL_EMULATION_UNAVAILABLE');
  assert.equal(plan.strategy, 'post_fill_emulation_unavailable');
});

test('requires both protection legs and treats unprotected entries separately', () => {
  const incomplete = resolveBracketProtectionPlan({
    capabilities: bybitCapabilities,
    marketType: 'futures',
    orderType: 'market',
    stopLoss: '90',
  });
  assert.equal(incomplete.supported, false);
  assert.equal(incomplete.code, 'TP_SL_PAIR_REQUIRED');

  const unprotected = resolveBracketProtectionPlan({
    capabilities: {},
    marketType: 'spot',
    orderType: 'market',
  });
  assert.equal(unprotected.supported, true);
  assert.equal(unprotected.strategy, 'none');
});
