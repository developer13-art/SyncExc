/**
 * SyncExc Server — Duplicate order rule
 *
 * Detects orders that look like an accidental duplicate within a short window.
 */

export function createDuplicateOrderRule() {
  return {
    type: 'duplicate_order',

    async evaluate({ config, context }) {
      const failures = [];
      const results = [];

      // Caller supplies recentOrders within the window
      const window = config.windowMs || 60000;
      const recent = (context.recentOrders || []).filter(
        (o) => Date.now() - new Date(o.createdAt).getTime() < window
      );

      const { instrument, side, quantity } = context.order || {};
      const duplicate = recent.find(
        (o) =>
          o.instrument === instrument &&
          o.side === side &&
          String(o.quantity) === String(quantity)
      );

      if (duplicate) {
        failures.push({
          ruleType: 'duplicate_order',
          result: 'failed',
          reason: `Possible duplicate of order placed ${Math.round((Date.now() - new Date(duplicate.createdAt).getTime()) / 1000)}s ago`,
          measuredValue: duplicate.id,
        });
      } else {
        results.push({ ruleType: 'duplicate_order', result: 'passed' });
      }

      return { failures, results };
    },
  };
}

export default createDuplicateOrderRule;