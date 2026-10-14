/**
 * SyncExc Server — Rule registry
 */

import { createOrderLimitRule } from './order-limit.rule.js';
import { createPositionLimitRule } from './position-limit.rule.js';
import { createNotionalLimitRule } from './notional-limit.rule.js';
import { createLeverageRule } from './leverage.rule.js';
import { createExposureAggregationRule } from './exposure-aggregation.rule.js';
import { createDataFreshnessRule } from './data-freshness.rule.js';
import { createDuplicateOrderRule } from './duplicate-order.rule.js';

export function createRuleRegistry({ logger }) {
  const rules = new Map();

  rules.set('order_limit', createOrderLimitRule());
  rules.set('position_limit', createPositionLimitRule());
  rules.set('notional_limit', createNotionalLimitRule());
  rules.set('leverage', createLeverageRule());
  rules.set('exposure_aggregation', createExposureAggregationRule());
  rules.set('data_freshness', createDataFreshnessRule());
  rules.set('duplicate_order', createDuplicateOrderRule());

  return {
    get(ruleType) {
      return rules.get(ruleType) || null;
    },
    list() {
      return Array.from(rules.keys());
    },
    register(ruleType, rule) {
      rules.set(ruleType, rule);
    },
  };
}

export default createRuleRegistry;