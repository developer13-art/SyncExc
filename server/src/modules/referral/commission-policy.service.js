/**
 * SyncExc Server — Commission policy service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createCommissionPolicyService({ db, queries, events, logger }) {
  async function createPolicy({ userId, name, config, effectiveFrom }) {
    return db.tx(async (tx) => {
      const policy = await queries.insertPolicy(tx, {
        name,
        createdBy: userId,
      });

      const version = await queries.insertPolicyVersion(tx, {
        policyId: policy.id,
        version: 1,
        config,
        effectiveFrom: effectiveFrom || new Date(),
      });

      return { policy, version };
    });
  }

  async function createNewVersion({ userId, policyId, config, effectiveFrom }) {
    const policy = await queries.findPolicyById(policyId);
    if (!policy) throw new NotFoundError('Policy');

    const latest = await queries.findLatestPolicyVersion(policyId);
    const nextVersion = (latest?.version || 0) + 1;

    return db.tx(async (tx) => {
      const version = await queries.insertPolicyVersion(tx, {
        policyId,
        version: nextVersion,
        config,
        effectiveFrom: effectiveFrom || new Date(),
      });

      return version;
    });
  }

  async function publishPolicy({ userId, policyId }) {
    const policy = await queries.findPolicyById(policyId);
    if (!policy) throw new NotFoundError('Policy');

    return db.tx(async (tx) => {
      const updated = await queries.updatePolicyStatus(policyId, 'active');

      await events.publish(
        tx,
        'referral.policy_published',
        { policyId },
        {
          actorId: userId,
          resourceType: 'commission_policy',
          resourceId: policyId,
        }
      );

      return updated;
    });
  }

  async function listPolicies({ status }) {
    const policies = await queries.listPolicies({ status });
    const result = [];
    for (const policy of policies) {
      const active = await queries.findActivePolicyVersion(policy.id);
      result.push({
        ...policy,
        active_version: active,
      });
    }
    return result;
  }

  async function getActiveVersion(policyId) {
    const policy = await queries.findPolicyById(policyId);
    if (!policy) throw new NotFoundError('Policy');
    if (policy.status !== 'active') throw new ConflictError('Policy is not active', 'POLICY_INACTIVE');
    const version = await queries.findActivePolicyVersion(policyId);
    if (!version) throw new NotFoundError('Active version');
    return version;
  }

  return {
    createPolicy,
    createNewVersion,
    publishPolicy,
    listPolicies,
    getActiveVersion,
  };
}

export default createCommissionPolicyService;