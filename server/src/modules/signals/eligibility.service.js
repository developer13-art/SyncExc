/**
 * SyncExc Server — Signal eligibility service
 *
 * Final decision before execution-intent creation. Produces an explicit,
 * auditable eligibility outcome.
 */

import { ELIGIBILITY_OUTCOME } from '@syncexc/shared';

const RULE_SET_VERSION = 'v1';

export function createEligibilityService({ db, queries, events, logger }) {
  async function decideEligibility({ candidateId }) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate) return null;

    const issues = await queries.listOpenIssues(candidateId);
    const source = await db.query(`SELECT * FROM signal_sources WHERE id = $1`, [candidate.source_id]);
    const sourceRow = source.rows[0];

    const reasons = [];
    let outcome;

    // Rules in precedence order
    if (!sourceRow || !['active', 'approved'].includes(sourceRow.status)) {
      outcome = ELIGIBILITY_OUTCOME.BLOCKED_SOURCE;
      reasons.push({ rule: 'source_status', value: sourceRow?.status || 'missing' });
    } else if (candidate.status === 'canceled') {
      outcome = ELIGIBILITY_OUTCOME.BLOCKED_CANCELED;
      reasons.push({ rule: 'candidate_canceled' });
    } else if (candidate.status === 'expired') {
      outcome = ELIGIBILITY_OUTCOME.BLOCKED_STATE;
      reasons.push({ rule: 'candidate_expired' });
    } else if (issues.some((i) => i.severity === 'critical')) {
      outcome = ELIGIBILITY_OUTCOME.BLOCKED_INVALID;
      reasons.push({ rule: 'critical_issues', count: issues.filter((i) => i.severity === 'critical').length });
    } else if (issues.some((i) => i.severity === 'high')) {
      outcome = ELIGIBILITY_OUTCOME.REVIEW_REQUIRED;
      reasons.push({ rule: 'high_issues', count: issues.filter((i) => i.severity === 'high').length });
    } else if (!candidate.instrument || !candidate.direction) {
      outcome = ELIGIBILITY_OUTCOME.WAITING_FOR_DATA;
      reasons.push({ rule: 'missing_required_fields' });
    } else {
      // Check for duplicate execution intents
      const existing = await db.query(
        `
        SELECT 1 FROM trading_execution_intents
        WHERE signal_id = $1 AND status IN ('created', 'held', 'dispatched')
        LIMIT 1
        `,
        [candidateId]
      );
      if (existing.rows.length > 0) {
        outcome = ELIGIBILITY_OUTCOME.BLOCKED_DUPLICATE;
        reasons.push({ rule: 'duplicate_intent_exists' });
      } else {
        outcome = ELIGIBILITY_OUTCOME.ELIGIBLE_FOR_HANDOFF;
        reasons.push({ rule: 'all_checks_passed' });
      }
    }

    const decision = await db.tx(async (tx) => {
      const d = await queries.insertEligibilityDecision(tx, {
        candidateId,
        outcome,
        ruleSetVersion: RULE_SET_VERSION,
        reasons,
      });

      await queries.updateCandidate(candidateId, {
        eligibilityOutcome: outcome,
        status: outcome === ELIGIBILITY_OUTCOME.ELIGIBLE_FOR_HANDOFF ? 'eligible' : 'blocked',
      });

      if (outcome === ELIGIBILITY_OUTCOME.ELIGIBLE_FOR_HANDOFF) {
        await events.publish(
          tx,
          'signal.eligible',
          { candidateId },
          {
            resourceType: 'signal_candidate',
            resourceId: candidateId,
          }
        );
      } else {
        await events.publish(
          tx,
          'signal.blocked',
          { candidateId, outcome, reasons },
          {
            resourceType: 'signal_candidate',
            resourceId: candidateId,
          }
        );
      }

      return d;
    });

    return { decision, outcome, reasons };
  }

  return {
    decideEligibility,
  };
}

export default createEligibilityService;