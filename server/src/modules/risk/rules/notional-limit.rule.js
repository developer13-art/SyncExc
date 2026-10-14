/**
 * SyncExc Server — Notional limit rule
 */

export function createNotionalLimitRule() {
  return {
    type: 'notional_limit',

    async evaluate({ config, context }) {
      const failures = [];
      const results = [];

      const { quantity, price } = context.order || {};
      const notional = Number(quantity || 0) * Number(price || 0);

      if (config.maxOrderNotional && notional > Number(config.maxOrderNotional)) {
        failures.push({
          ruleType: 'notional_limit',
          result: 'failed',
          measuredValue: String(notional),
          limitValue: String(config.maxOrderNotional),
          reason: `Order notional ${notional} exceeds max ${config.maxOrderNotional}`,
        });
      } else {
        results.push({
          ruleType: 'notional_limit',
          result: 'passed',
          measuredValue: String(notional),
        });
      }

      return { failures, results };
    },
  };
}

export default createNotionalLimitRule;