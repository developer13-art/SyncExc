/**
 * SyncExc Server — Feature flag service
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

const VALID_TYPES = ['release', 'operational_control', 'experiment', 'emergency_kill_switch'];
const VALID_ENVIRONMENTS = ['development', 'staging', 'production'];

export function createFeatureFlagService({ db, queries, events, approvals, audit, logger }) {
  async function createFlag({
    userId,
    key,
    description,
    owningTeam,
    relatedModule,
    type,
    defaultValue,
    environment,
    targetingRules,
    expiresAt,
  }) {
    if (!VALID_TYPES.includes(type)) {
      throw new ValidationError(`Invalid flag type: ${type}`);
    }
    if (!VALID_ENVIRONMENTS.includes(environment)) {
      throw new ValidationError(`Invalid environment: ${environment}`);
    }
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(key)) {
      throw new ValidationError('Flag key must be lowercase alphanumeric with underscores');
    }

    const existing = await queries.findFeatureFlagByKey(key);
    if (existing) throw new ConflictError('Flag key is taken', 'FLAG_KEY_TAKEN');

    return db.tx(async (tx) => {
      const flag = await queries.insertFeatureFlag(tx, {
        key,
        description,
        owningTeam,
        relatedModule,
        type,
        defaultValue,
        environment,
        expiresAt,
        createdBy: userId,
      });

      await queries.insertFeatureFlagVersion(tx, {
        flagId: flag.id,
        version: 1,
        snapshot: flag,
        publishedBy: userId,
      });

      for (const rule of targetingRules || []) {
        await queries.insertFeatureFlagRule(tx, {
          flagId: flag.id,
          ruleType: rule.type,
          ruleConfig: rule.config,
          priority: rule.priority || 100,
        });
      }

      await audit.write({
        actorId: userId,
        action: 'feature_flag.created',
        targetResource: 'admin_feature_flag',
        targetId: flag.id,
        after: { key, type, environment },
      });

      return flag;
    });
  }

  async function listFlags({ environment } = {}) {
    return queries.listFeatureFlags({ environment });
  }

  async function getFlag({ flagId }) {
    const flag = await queries.findFeatureFlagById(flagId);
    if (!flag) throw new NotFoundError('Feature flag');
    const rules = await queries.listFeatureFlagRules(flagId);
    return { flag, rules };
  }

  async function updateFlag({ userId, flagId, enabled, defaultValue, targetingRules, reason }) {
    const flag = await queries.findFeatureFlagById(flagId);
    if (!flag) throw new NotFoundError('Feature flag');

    return db.tx(async (tx) => {
      const before = { enabled: flag.enabled, defaultValue: flag.default_value };

      const updated = await queries.updateFeatureFlag(flagId, {
        enabled,
        defaultValue,
      });

      if (targetingRules) {
        await tx.query(`DELETE FROM admin_feature_flag_rules WHERE flag_id = $1`, [flagId]);
        for (const rule of targetingRules) {
          await queries.insertFeatureFlagRule(tx, {
            flagId,
            ruleType: rule.type,
            ruleConfig: rule.config,
            priority: rule.priority || 100,
          });
        }
      }

      await queries.insertFeatureFlagVersion(tx, {
        flagId,
        version: Date.now(),
        snapshot: updated,
        publishedBy: userId,
      });

      await queries.insertRolloutEvent(tx, {
        flagId,
        eventType: 'updated',
        previousState: before,
        newState: { enabled: updated.enabled, defaultValue: updated.default_value },
        actorId: userId,
        reason,
      });

      await audit.write({
        actorId: userId,
        action: 'feature_flag.updated',
        targetResource: 'admin_feature_flag',
        targetId: flagId,
        before,
        after: { enabled: updated.enabled, defaultValue: updated.default_value },
        reason,
      });

      await events.publish(
        tx,
        'admin.feature_flag_changed',
        { flagId, key: flag.key, enabled: updated.enabled, reason },
        {
          actorId: userId,
          resourceType: 'admin_feature_flag',
          resourceId: flagId,
        }
      );

      return updated;
    });
  }

  async function rollout({ userId, flagId, targetPercentage, targetRules, environment, reason }) {
    const flag = await queries.findFeatureFlagById(flagId);
    if (!flag) throw new NotFoundError('Feature flag');

    // Require second approver for broad rollouts
    const isBroadRollout = targetPercentage >= 25;
    if (isBroadRollout && approvals.isProtected('feature_flag.rollout')) {
      const approval = await approvals.requestApproval({
        actionType: 'feature_flag.rollout',
        actionPayload: { flagId, targetPercentage, environment },
        requestedBy: userId,
        reason,
      });
      return { requiresApproval: true, approval };
    }

    return db.tx(async (tx) => {
      const before = { enabled: flag.enabled };
      const updated = await queries.updateFeatureFlag(flagId, { enabled: true });

      // Replace targeting rules with new rollout rules
      await tx.query(`DELETE FROM admin_feature_flag_rules WHERE flag_id = $1`, [flagId]);
      await queries.insertFeatureFlagRule(tx, {
        flagId,
        ruleType: 'percentage_rollout',
        ruleConfig: { percentage: targetPercentage },
        priority: 50,
      });
      for (const rule of targetRules || []) {
        await queries.insertFeatureFlagRule(tx, {
          flagId,
          ruleType: rule.type,
          ruleConfig: rule.config,
          priority: rule.priority || 100,
        });
      }

      await queries.insertRolloutEvent(tx, {
        flagId,
        eventType: 'rollout_initiated',
        previousState: before,
        newState: { enabled: true, targetPercentage },
        actorId: userId,
        reason,
      });

      await audit.write({
        actorId: userId,
        action: 'feature_flag.rollout',
        targetResource: 'admin_feature_flag',
        targetId: flagId,
        after: { targetPercentage, environment },
        reason,
      });

      return { updated, targetPercentage };
    });
  }

  async function rollback({ userId, flagId, reason }) {
    const flag = await queries.findFeatureFlagById(flagId);
    if (!flag) throw new NotFoundError('Feature flag');

    return db.tx(async (tx) => {
      const before = { enabled: flag.enabled };
      const updated = await queries.updateFeatureFlag(flagId, { enabled: false });

      await tx.query(`DELETE FROM admin_feature_flag_rules WHERE flag_id = $1`, [flagId]);

      await queries.insertRolloutEvent(tx, {
        flagId,
        eventType: 'rollback',
        previousState: before,
        newState: { enabled: false },
        actorId: userId,
        reason,
      });

      await audit.write({
        actorId: userId,
        action: 'feature_flag.rollback',
        targetResource: 'admin_feature_flag',
        targetId: flagId,
        before,
        after: { enabled: false },
        reason,
      });

      return updated;
    });
  }

  return {
    createFlag,
    listFlags,
    getFlag,
    updateFlag,
    rollout,
    rollback,
  };
}

export default createFeatureFlagService;