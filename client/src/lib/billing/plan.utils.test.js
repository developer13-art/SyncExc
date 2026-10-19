import { describe, expect, it } from 'vitest';

import { normalizePlan, normalizePlans } from './plan.utils.js';

describe('normalizePlan', () => {
  it('uses the monthly price and converts minor currency units to major units', () => {
    const plan = normalizePlan({
      id: 'pro',
      prices: [
        { id: 'yearly', currency: 'USD', amountMinor: 29000, billingInterval: 'yearly' },
        { id: 'monthly', currency: 'USD', amountMinor: 2900, billingInterval: 'monthly' },
      ],
    });

    expect(plan).toMatchObject({
      price: 29,
      currency: 'USD',
      billingInterval: 'month',
    });
    expect(plan.prices[0].id).toBe('yearly');
  });

  it('keeps a zero-price plan at zero and formats enabled features', () => {
    const plan = normalizePlan({
      prices: [{ currency: 'USD', amountMinor: 0, billingInterval: 'monthly' }],
      features: { 'automation.enabled': true, 'simulation.enabled': false },
    });

    expect(plan.price).toBe(0);
    expect(plan.features).toEqual([{ label: 'Automation' }]);
  });

  it('uses a zero-decimal currency exponent and supports plans without prices', () => {
    expect(
      normalizePlan({
        prices: [{ currency: 'JPY', amountMinor: 1500, billingInterval: 'monthly' }],
      }).price,
    ).toBe(1500);
    expect(normalizePlan({ id: 'contact' })).toMatchObject({ id: 'contact', features: [] });
    expect(
      normalizePlan({
        prices: [{ currency: 'USD', amountMinor: null, billingInterval: 'monthly' }],
      }).price,
    ).toBeNull();
  });

  it('normalizes a plan collection and tolerates an invalid collection shape', () => {
    expect(normalizePlans([{ prices: [] }])).toHaveLength(1);
    expect(normalizePlans(null)).toEqual([]);
  });
});
