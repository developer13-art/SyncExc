/**
 * SyncExc Server — Signal confidence scoring
 */

export function createConfidenceService({ db, queries, logger }) {
  /**
   * Compute an overall confidence level for a candidate based on field
   * provenance and unresolved issues.
   */
  async function computeConfidence({ candidateId }) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate) return 'unresolved';

    const issues = await queries.listOpenIssues(candidateId);

    // Critical issue = unresolved
    if (issues.some((i) => i.severity === 'critical')) return 'unresolved';

    // High issues = low confidence
    const highIssues = issues.filter((i) => i.severity === 'high').length;
    if (highIssues > 0) return 'low';

    // Medium issues = medium confidence
    const mediumIssues = issues.filter((i) => i.severity === 'medium').length;
    if (mediumIssues > 0) return 'medium';

    // No issues + deterministic parser = high
    return 'high';
  }

  return {
    computeConfidence,
  };
}

export default createConfidenceService;