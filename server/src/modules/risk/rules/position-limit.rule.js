/**
 * SyncExc Server — Position limit rule
 */

export function createPositionLimitRule() {
  return {
    type: 'position_limit',

    async evaluate({ config, context }) {
      const failures = [];
      const results = [];

      const { currentPosition = 0, positionChange = 0 } = context.exposure || {};
      const projected = Number(currentPosition) + Number(positionChange);

      if (config.maxPositionQuantity && Math.abs(projected) > Number(config.maxPositionQuantity)) {
        failures.push({
          ruleType: 'position_limit',
          result: 'failed',
          measuredValue: String(projected),
          limitValue: String(config.maxPositionQuantity),
          reason: `Projected position ${projected} exceeds limit ${config.maxPositionQuantity}`,
        });
      } else {
        results.push({
          ruleType: 'position_limit',
          result: 'passed',
          measuredValue: String(projected),
          limitValue: String(config.maxPositionQuantity || 'unlimited'),
        });
      }

      if (
        config.maxPositionNotional &&
        context.exposure?.price &&
        Math.abs(projected * Number(context.exposure.price)) > Number(config.maxPositionNotional)
      ) {
        failures.push({
          ruleType: 'position_limit',
          result: 'failed',
          reason: `Projected position notional exceeds ${config.maxPositionNotional}`,
        });
      }

      return { failures, results };
    },
  };
}

export default createPositionLimitRule;