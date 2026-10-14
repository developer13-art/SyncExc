/**
 * SyncExc Server — Risk policy service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createPolicyService({ db, queries, events, logger }) {
  async function createPolicy({
    userId,
    workspaceId,
    name,
    scope,
    scopeRef,
    enforcementMode,
    rules,
  }) {
    return db.tx(async (tx) => {
      const policy = await queries.insertPolicy(tx, {
        workspaceId,
        name,
        scope,
        scopeRef,
        enforcementMode,
        status: 'active',
        createdBy: userId,
      });

      // Version 1 snapshot
      await queries.insertPolicyVersion(tx, {
        policyId: policy.id,
        version: 1,
        snapshot: { policy, rules },
      });

      // Insert rule configurations
      for (const rule of rules) {
        await queries.insertRuleConfiguration(tx, {
          policyId: policy.id,
          ruleType: rule.type,
          config: rule.config,
        });
      }

      await events.publish(
        tx,
        'risk.policy_created',
        { policyId: policy.id, scope, enforcementMode },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'risk_policy',
          resourceId: policy.id,
        }
      );

      return policy;
    });
  }

  async function listPolicies({ workspaceId, status }) {
    const policies = await queries.listPoliciesForWorkspace(workspaceId, { status });
    const result = [];
    for (const policy of policies) {
      const rules = await queries.listActiveRulesForPolicy(policy.id);
      result.push({ ...policy, rules });
    }
    return result;
  }

  async function getPolicy({ policyId, workspaceId }) {
    const policy = await queries.findPolicyById(policyId);
    if (!policy) throw new NotFoundError('Risk policy');
    if (policy.workspace_id !== workspaceId && policy.scope !== 'platform') {
      throw new NotFoundError('Risk policy');
    }
    const rules = await queries.listActiveRulesForPolicy(policyId);
    return { policy, rules };
  }

  async function suspendPolicy({ userId, workspaceId, policyId }) {
    const policy = await queries.findPolicyById(policyId);
    if (!policy) throw new NotFoundError('Risk policy');
    if (policy.workspace_id !== workspaceId) throw new NotFoundError('Risk policy');
    if (policy.scope === 'platform') {
      throw new ConflictError('Platform policies cannot be suspended from here', 'PLATFORM_POLICY');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updatePolicyStatus(policyId, 'suspended');
      await events.publish(
        tx,
        'risk.policy_suspended',
        { policyId },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'risk_policy',
          resourceId: policyId,
        }
      );
      return updated;
    });
  }

  /**
   * Load the active policies for a given operation context.
   * Policies are evaluated in order of scope precedence:
   *   platform → workspace → sync_group → exchange_account → instrument → operation
   */
  async function getApplicablePolicies({
    workspaceId,
    syncGroupId,
    accountId,
    instrument,
  }) {
    const scopes = [
      { scope: 'platform', scopeRef: null },
      { scope: 'workspace', scopeRef: null },
    ];
    if (syncGroupId) scopes.push({ scope: 'sync_group', scopeRef: syncGroupId });
    if (accountId) scopes.push({ scope: 'exchange_account', scopeRef: accountId });
    if (instrument) scopes.push({ scope: 'instrument', scopeRef: instrument });

    const applicable = [];
    for (const { scope, scopeRef } of scopes) {
      const policies = await queries.listActivePoliciesForScope({
        workspaceId,
        scope,
        scopeRef,
      });
      for (const policy of policies) {
        const rules = await queries.listActiveRulesForPolicy(policy.id);
        applicable.push({ ...policy, rules });
      }
    }

    return applicable;
  }

  return {
    createPolicy,
    listPolicies,
    getPolicy,
    suspendPolicy,
    getApplicablePolicies,
  };
}

export default createPolicyService;