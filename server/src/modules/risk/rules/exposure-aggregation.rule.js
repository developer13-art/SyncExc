/**
 * SyncExc Server — Exposure aggregation rule
 */

export function createExposureAggregationRule() {
  return {
    type: 'exposure_aggregation',

    async evaluate({ config, context }) {
      const failures = [];
      const results = [];

      const currentExposure = Number(context.exposure?.workspaceTotal || 0);
      const newExposure = Number(context.order?.quantity || 0) * Number(context.order?.price || 0);
      const projected = currentExposure + newExposure;

      if (config.maxWorkspaceExposure && projected > Number(config.maxWorkspaceExposure)) {
        failures.push({
          ruleType: 'exposure_aggregation',
          result: 'failed',
          measuredValue: String(projected),
          limitValue: String(config.maxWorkspaceExposure),
          reason: `Projected workspace exposure ${projected} exceeds ${config.maxWorkspaceExposure}`,
        });
      } else {
        results.push({
          ruleType: 'exposure_aggregation',
          result: 'passed',
          measuredValue: String(projected),
          limitValue: String(config.maxWorkspaceExposure || 'unlimited'),
        });
      }

      return { failures, results };
    },
  };
}

export default createExposureAggregationRule;   