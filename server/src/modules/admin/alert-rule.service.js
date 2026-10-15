/**
 * SyncExc Server — Alert rule service
 */

import { NotFoundError, ValidationError } from '../../lib/errors.js';

const VALID_COMPARISONS = ['gt', 'gte', 'lt', 'lte', 'eq'];
const VALID_SEVERITIES = ['info', 'warning', 'high', 'critical'];

export function createAlertRuleService({ db, queries, audit, logger }) {
  async function createRule({ userId, name, metricKey, threshold, comparison, severity }) {
    if (!VALID_COMPARISONS.includes(comparison)) {
      throw new ValidationError(`Invalid comparison: ${comparison}`);
    }
    if (!VALID_SEVERITIES.includes(severity)) {
      throw new ValidationError(`Invalid severity: ${severity}`);
    }

    return db.tx(async (tx) => {
      const rule = await queries.insertAlertRule(tx, {
        name,
        metricKey,
        threshold,
        comparison,
        severity,
        createdBy: userId,
      });

      await audit.write({
        actorId: userId,
        action: 'alert_rule.created',
        targetResource: 'admin_alert_rule',
        targetId: rule.id,
        after: rule,
      });

      return rule;
    });
  }

  async function listRules({ enabled } = {}) {
    return queries.listAlertRules({ enabled });
  }

  async function updateRule({ ruleId, actorId, updates }) {
    const rule = await queries.listAlertRules({});
    const found = rule.find((r) => r.id === ruleId);
    if (!found) throw new NotFoundError('Alert rule');

    return db.tx(async (tx) => {
      const updated = await queries.updateAlertRule(ruleId, updates);

      await audit.write({
        actorId,
        action: 'alert_rule.updated',
        targetResource: 'admin_alert_rule',
        targetId: ruleId,
        before: found,
        after: updated,
      });

      return updated;
    });
  }

  return {
    createRule,
    listRules,
    updateRule,
  };
}

export default createAlertRuleService;