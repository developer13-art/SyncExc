/**
 * SyncExc Server — Leverage rule
 */

export function createLeverageRule() {
  return {
    type: 'leverage',

    async evaluate({ config, context }) {
      const failures = [];
      const results = [];

      const leverage = Number(context.order?.leverage || context.account?.leverage || 1);

      if (config.maxLeverage && leverage > Number(config.maxLeverage)) {
        failures.push({
          ruleType: 'leverage',
          result: 'failed',
          measuredValue: String(leverage),
          limitValue: String(config.maxLeverage),
          reason: `Leverage ${leverage}x exceeds max ${config.maxLeverage}x`,
        });
      } else {
        results.push({
          ruleType: 'leverage',
          result: 'passed',
          measuredValue: String(leverage),
          limitValue: String(config.maxLeverage || 'unlimited'),
        });
      }

      return { failures, results };
    },
  };
}

export default createLeverageRule;