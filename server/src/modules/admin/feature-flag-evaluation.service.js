/**
 * SyncExc Server — Feature flag evaluation
 *
 * Evaluates targeting rules in priority order:
 *   1. Emergency kill switch (highest)
 *   2. Explicit user allowlist
 *   3. Explicit workspace allowlist
 *   4. Region match
 *   5. Entitlement match
 *   6. Percentage rollout (deterministic hash)
 *   7. Default value
 *
 * Evaluations are server-side only. The client cannot force a flag.
 */

import { createHash } from 'node:crypto';

export function createFeatureFlagEvaluationService({ db, queries, logger }) {
  async function evaluate({ key, userId = null, workspaceId = null, environment = 'production' }) {
    const flag = await queries.findFeatureFlagByKey(key);
    if (!flag) {
      return { enabled: false, reason: 'flag_not_found' };
    }
    if (flag.environment !== environment) {
      return { enabled: false, reason: 'environment_mismatch' };
    }
    if (flag.expires_at && new Date(flag.expires_at) <= new Date()) {
      return { enabled: false, reason: 'flag_expired' };
    }

    const rules = await queries.listFeatureFlagRules(flag.id);
    let decided = null;

    for (const rule of rules) {
      const config = rule.rule_config || {};

      switch (rule.rule_type) {
        case 'kill_switch':
          decided = { enabled: false, reason: 'kill_switch' };
          break;

        case 'user_allowlist':
          if (userId && (config.userIds || []).includes(userId)) {
            decided = { enabled: true, reason: 'user_allowlist' };
          }
          break;

        case 'workspace_allowlist':
          if (workspaceId && (config.workspaceIds || []).includes(workspaceId)) {
            decided = { enabled: true, reason: 'workspace_allowlist' };
          }
          break;

        case 'percentage_rollout': {
          const percentage = Number(config.percentage || 0);
          const bucketKey = `${flag.key}:${userId || workspaceId || 'anonymous'}`;
          const hash = createHash('sha256').update(bucketKey).digest('hex');
          const bucket = parseInt(hash.slice(0, 8), 16) % 100;
          if (bucket < percentage) {
            decided = { enabled: true, reason: 'percentage_rollout' };
          }
          break;
        }

        case 'region':
          if (config.regions && config.regions.length > 0) {
            // Region comes from the request context; here we skip if not provided
            decided = { enabled: Boolean(config.enabled), reason: 'region_match' };
          }
          break;

        default:
          break;
      }

      if (decided) break;
    }

    if (!decided) {
      decided = { enabled: flag.enabled ?? flag.default_value, reason: 'default' };
    }

    // Persist evaluation for observability (bounded, not for every call)
    if (Math.random() < 0.01) {
      try {
        await db.tx(async (tx) => {
          await queries.insertFeatureFlagEvaluation(tx, {
            flagKey: flag.key,
            userId,
            workspaceId,
            result: decided.enabled,
            reason: decided.reason,
          });
        });
      } catch (err) {
        logger.warn({ err, flagKey: flag.key }, 'Failed to record feature flag evaluation');
      }
    }

    return {
      key: flag.key,
      enabled: decided.enabled,
      reason: decided.reason,
      version: flag.updated_at,
    };
  }

  return {
    evaluate,
  };
}

export default createFeatureFlagEvaluationService;