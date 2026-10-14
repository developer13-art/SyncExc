/**
 * SyncExc Server — Data freshness rule
 */

export function createDataFreshnessRule() {
  return {
    type: 'data_freshness',

    async evaluate({ config, context }) {
      const failures = [];
      const results = [];

      const maxAgeMs = config.maxAgeMs || 60000;
      const balanceUpdatedAt = context.account?.balanceUpdatedAt;
      const positionUpdatedAt = context.account?.positionUpdatedAt;

      const now = Date.now();
      const balanceAge = balanceUpdatedAt ? now - new Date(balanceUpdatedAt).getTime() : null;
      const positionAge = positionUpdatedAt ? now - new Date(positionUpdatedAt).getTime() : null;

      if (config.requireBalanceData && (balanceAge === null || balanceAge > maxAgeMs)) {
        failures.push({
          ruleType: 'data_freshness',
          result: 'failed',
          measuredValue: balanceAge === null ? 'missing' : String(balanceAge),
          limitValue: String(maxAgeMs),
          reason: 'Balance data is missing or stale',
        });
      } else {
        results.push({
          ruleType: 'data_freshness',
          result: 'passed',
          measuredValue: balanceAge !== null ? String(balanceAge) : 'missing',
        });
      }

      if (config.requirePositionData && (positionAge === null || positionAge > maxAgeMs)) {
        failures.push({
          ruleType: 'data_freshness',
          result: 'failed',
          measuredValue: positionAge === null ? 'missing' : String(positionAge),
          limitValue: String(maxAgeMs),
          reason: 'Position data is missing or stale',
        });
      }

      return { failures, results };
    },
  };
}

export default createDataFreshnessRule;