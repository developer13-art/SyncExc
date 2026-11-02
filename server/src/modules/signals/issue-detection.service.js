/**
 * SyncExc Server — Issue detection service
 *
 * Runs after extraction. Detects missing fields, ambiguous values,
 * contradictory pairs, and stale information.
 */

import { validatePrice, validateSymbol } from '@syncexc/shared';

export function createIssueDetectionService({ db, queries, logger }) {
  async function detectIssues({ candidateId }) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate) return [];

    const issues = [];
    const targets = await queries.listTargetsForCandidate(candidateId);

    // Missing instrument
    if (!candidate.instrument) {
      issues.push({
        issueType: 'missing_field',
        severity: 'critical',
        affectedFields: ['instrument'],
        detectionMethod: 'rule',
        evidence: { required: true },
      });
    }

    // Missing direction
    if (!candidate.direction) {
      issues.push({
        issueType: 'missing_field',
        severity: 'critical',
        affectedFields: ['direction'],
        detectionMethod: 'rule',
        evidence: { required: true },
      });
    }

    if (!candidate.market_type) {
      issues.push({
        issueType: 'missing_field',
        severity: 'high',
        affectedFields: ['market_type'],
        detectionMethod: 'rule',
        evidence: { required: true },
      });
    }

    if (!candidate.order_type) {
      issues.push({
        issueType: 'missing_field',
        severity: 'high',
        affectedFields: ['order_type'],
        detectionMethod: 'rule',
        evidence: { required: true },
      });
    }

    // Missing entry (both scalar and range)
    if (!candidate.entry && !candidate.entry_range) {
      issues.push({
        issueType: 'missing_field',
        severity: 'high',
        affectedFields: ['entry'],
        detectionMethod: 'rule',
        evidence: { required: true },
      });
    }

    if (!candidate.stop_loss) {
      issues.push({
        issueType: 'missing_field',
        severity: 'high',
        affectedFields: ['stop_loss'],
        detectionMethod: 'rule',
        evidence: { required: true },
      });
    }

    if (targets.length === 0) {
      issues.push({
        issueType: 'missing_field',
        severity: 'high',
        affectedFields: ['targets'],
        detectionMethod: 'rule',
        evidence: { required: true },
      });
    }

    // Contradictory entry and entry range
    if (candidate.entry && candidate.entry_range) {
      issues.push({
        issueType: 'contradictory_value',
        severity: 'high',
        affectedFields: ['entry', 'entry_range'],
        detectionMethod: 'rule',
        evidence: { reason: 'both scalar and range provided' },
      });
    }

    // Validate stop loss direction
    if (candidate.stop_loss && candidate.entry) {
      const sl = Number(candidate.stop_loss);
      const entry = Number(candidate.entry);
      if (candidate.direction === 'long' && sl >= entry) {
        issues.push({
          issueType: 'contradictory_value',
          severity: 'high',
          affectedFields: ['stop_loss'],
          detectionMethod: 'rule',
          evidence: { reason: 'stop-loss should be below entry for long' },
        });
      }
      if (candidate.direction === 'short' && sl <= entry) {
        issues.push({
          issueType: 'contradictory_value',
          severity: 'high',
          affectedFields: ['stop_loss'],
          detectionMethod: 'rule',
          evidence: { reason: 'stop-loss should be above entry for short' },
        });
      }
    }

    // Validate target direction
    if (candidate.entry && targets.length > 0) {
      const entry = Number(candidate.entry);
      for (const target of targets) {
        const t = Number(target.value);
        if (candidate.direction === 'long' && t <= entry) {
          issues.push({
            issueType: 'contradictory_value',
            severity: 'medium',
            affectedFields: [`target.${target.ordinal}`],
            detectionMethod: 'rule',
            evidence: { reason: `target ${target.value} below entry for long` },
          });
        }
        if (candidate.direction === 'short' && t >= entry) {
          issues.push({
            issueType: 'contradictory_value',
            severity: 'medium',
            affectedFields: [`target.${target.ordinal}`],
            detectionMethod: 'rule',
            evidence: { reason: `target ${target.value} above entry for short` },
          });
        }
      }
    }

    // Validate instrument format
    if (candidate.instrument) {
      const v = validateSymbol(candidate.instrument);
      if (!v.valid) {
        issues.push({
          issueType: 'invalid_value',
          severity: 'high',
          affectedFields: ['instrument'],
          detectionMethod: 'rule',
          evidence: { error: v.error },
        });
      }
    }

    // Store issues
    const existingIssues = await queries.listOpenIssues(candidateId);
    const persisted = [];
    for (const issue of issues) {
      const alreadyExists = existingIssues.some((existing) =>
        existing.issue_type === issue.issueType &&
        JSON.stringify(existing.affected_fields || []) === JSON.stringify(issue.affectedFields)
      );
      if (alreadyExists) continue;
      await db.tx(async (tx) => {
        const created = await queries.insertIssue(tx, {
          candidateId,
          issueType: issue.issueType,
          severity: issue.severity,
          affectedFields: issue.affectedFields,
          evidence: issue.evidence,
          detectionMethod: issue.detectionMethod,
        });
        persisted.push(created);
      });
    }

    return persisted;
  }

  /**
   * Determine whether a candidate has any open blocking issues.
   */
  async function hasBlockingIssues(candidateId) {
    const issues = await queries.listOpenIssues(candidateId);
    return issues.some((i) => ['critical', 'high'].includes(i.severity));
  }

  return {
    detectIssues,
    hasBlockingIssues,
  };
}

export default createIssueDetectionService;