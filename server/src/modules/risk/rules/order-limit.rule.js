/**
 * SyncExc Server — Order limit rule
 *
 * Enforces:
 *   - max quantity per order
 *   - max notional per order
 *   - min notional per order
 */

export function createOrderLimitRule() {
  return {
    type: 'order_limit',

    async evaluate({ config, context }) {
      const failures = [];
      const results = [];

      const { quantity, price, side } = context.order || {};
      const numQty = Number(quantity || 0);
      const numPrice = Number(price || 0);
      const notional = numQty * numPrice;

      if (config.maxQuantity && numQty > Number(config.maxQuantity)) {
        failures.push({
          ruleType: 'order_limit',
          result: 'failed',
          measuredValue: String(numQty),
          limitValue: String(config.maxQuantity),
          reason: `Order quantity ${numQty} exceeds max ${config.maxQuantity}`,
        });
      } else {
        results.push({
          ruleType: 'order_limit',
          result: 'passed',
          measuredValue: String(numQty),
          limitValue: String(config.maxQuantity || 'unlimited'),
          reason: 'Order quantity within limit',
        });
      }

      if (config.maxNotional && numPrice > 0 && notional > Number(config.maxNotional)) {
        failures.push({
          ruleType: 'order_limit',
          result: 'failed',
          measuredValue: String(notional),
          limitValue: String(config.maxNotional),
          reason: `Order notional ${notional} exceeds max ${config.maxNotional}`,
        });
      }

      if (config.minNotional && numPrice > 0 && notional < Number(config.minNotional)) {
        failures.push({
          ruleType: 'order_limit',
          result: 'failed',
          measuredValue: String(notional),
          limitValue: String(config.minNotional),
          reason: `Order notional ${notional} below min ${config.minNotional}`,
        });
      }

      if (config.allowedSides && !config.allowedSides.includes(side)) {
        failures.push({
          ruleType: 'order_limit',
          result: 'failed',
          reason: `Side ${side} is not permitted`,
        });
      }

      return { failures, results };
    },
  };
}

export default createOrderLimitRule;