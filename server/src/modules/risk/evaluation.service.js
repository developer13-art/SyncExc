/**
 * SyncExc Server — Risk evaluation service
 */

import { AppError } from '../../lib/errors.js';
import { RISK_DECISION_OUTCOME, RISK_ENFORCEMENT_MODE } from '@syncexc/shared';

export function createEvaluationService({
  db,
  queries,
  ruleRegistry,
  policyService,
  exposureService,
  reservationService,
  events,
  logger,
}) {
  /**
   * Evaluate an operation against all applicable policies.
   */
  async function evaluate({ workspaceId, operationType, operationPayload }) {
    const context = {
      order: {
        side: operationPayload.side,
        quantity: operationPayload.quantity,
        price: operationPayload.price,
        type: operationPayload.type,
        instrument: operationPayload.instrument,
        leverage: operationPayload.leverage,
      },
      account: {
        balanceUpdatedAt: operationPayload.balanceUpdatedAt,
        positionUpdatedAt: operationPayload.positionUpdatedAt,
      },
      recentOrders: operationPayload.recentOrders || [],
      exposure: {},
    };

    // Calculate current exposure for aggregation rules
    try {
      const workspaceExposure = await exposureService.getWorkspaceExposure(workspaceId);
      context.exposure.workspaceTotal = workspaceExposure.grossExposure;
      context.exposure.currentPosition = operationPayload.currentPosition || 0;
      context.exposure.positionChange = Number(operationPayload.quantity || 0);
      context.exposure.price = operationPayload.price;
    } catch (err) {
      logger.warn({ err }, 'Failed to load exposure for risk evaluation');
    }

    // Load applicable policies
    const policies = await policyService.getApplicablePolicies({
      workspaceId,
      syncGroupId: operationPayload.syncGroupId,
      accountId: operationPayload.accountId,
      instrument: operationPayload.instrument,
    });

    if (policies.length === 0) {
      // No policy = default allow
      return createEvaluationResult({
        outcome: RISK_DECISION_OUTCOME.APPROVED,
        reasonCode: 'NO_POLICY',
        checkResults: [],
        workspaceId,
        operationType,
        operationPayload,
      });
    }

    // Evaluate each policy's rules
    const failures = [];
    const results = [];
    let enforcementMode = 'block';

    for (const policy of policies) {
      for (const ruleConfig of policy.rules) {
        const rule = ruleRegistry.get(ruleConfig.rule_type);
        if (!rule) continue;

        try {
          const outcome = await rule.evaluate({
            config: ruleConfig.config,
            context,
          });
          results.push(...outcome.results);
          failures.push(...outcome.failures.map((f) => ({ ...f, policyId: policy.id })));
        } catch (err) {
          logger.error({ err, ruleType: ruleConfig.rule_type }, 'Rule evaluation failed');
          failures.push({
            ruleType: ruleConfig.rule_type,
            result: 'error',
            reason: `Rule evaluation error: ${err.message}`,
          });
        }
      }

      // Highest-priority enforcement mode wins
      if (policy.enforcement_mode === RISK_ENFORCEMENT_MODE.BLOCK) {
        enforcementMode = 'block';
        break;
      }
      if (policy.enforcement_mode === RISK_ENFORCEMENT_MODE.REQUIRE_ADDITIONAL_APPROVAL) {
        enforcementMode = 'approval';
      } else if (enforcementMode !== 'approval' && policy.enforcement_mode === RISK_ENFORCEMENT_MODE.REQUIRE_CONFIRMATION) {
        enforcementMode = 'confirmation';
      }
    }

    let outcome;
    if (failures.length === 0) {
      outcome = RISK_DECISION_OUTCOME.APPROVED;
    } else if (enforcementMode === 'block') {
      outcome = RISK_DECISION_OUTCOME.BLOCKED;
    } else if (enforcementMode === 'approval') {
      outcome = RISK_DECISION_OUTCOME.APPROVAL_REQUIRED;
    } else if (enforcementMode === 'confirmation') {
      outcome = RISK_DECISION_OUTCOME.CONFIRMATION_REQUIRED;
    } else {
      outcome = RISK_DECISION_OUTCOME.BLOCKED;
    }

    return createEvaluationResult({
      outcome,
      reasonCode: failures[0]?.ruleType || 'OK',
      checkResults: [...results, ...failures],
      workspaceId,
      operationType,
      operationPayload,
    });
  }

  async function createEvaluationResult({
    outcome,
    reasonCode,
    checkResults,
    workspaceId,
    operationType,
    operationPayload,
  }) {
    return db.tx(async (tx) => {
      const evaluation = await queries.insertEvaluation(tx, {
        workspaceId,
        operationType,
        operationPayload,
        outcome,
        reasonCode,
      });

      for (const result of checkResults) {
        await queries.insertEvaluationResult(tx, {
          evaluationId: evaluation.id,
          ruleType: result.ruleType,
          result: result.result,
          measuredValue: result.measuredValue,
          limitValue: result.limitValue,
          reason: result.reason,
        });
      }

      await events.publish(
        tx,
        'risk.evaluated',
        {
          evaluationId: evaluation.id,
          outcome,
          reasonCode,
          operationType,
        },
        {
          workspaceId,
          resourceType: 'risk_evaluation',
          resourceId: evaluation.id,
        }
      );

      return {
        id: evaluation.id,
        outcome,
        reasonCode,
        checkResults,
        evaluatedAt: evaluation.evaluated_at,
      };
    });
  }

  async function getEvaluation({ evaluationId, workspaceId }) {
    const evaluation = await queries.findEvaluationById(evaluationId);
    if (!evaluation || evaluation.workspace_id !== workspaceId) return null;
    const results = await queries.listEvaluationResults(evaluationId);
    return { evaluation, results };
  }

  async function listEvaluations({ workspaceId, limit, cursor }) {
    return queries.listEvaluationsForWorkspace(workspaceId, { limit, cursor });
  }

  return {
    evaluate,
    getEvaluation,
    listEvaluations,
  };
}

export default createEvaluationService;