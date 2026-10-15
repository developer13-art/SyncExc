/**
 * SyncExc Server — Duplicate detection service
 */

export function createDuplicateDetectionService({ db, queries, logger }) {
  /**
   * Check if a candidate is a duplicate of an existing source.
   */
  async function findDuplicates({ workspaceId, candidate }) {
    const exactMatches = [];

    if (candidate.url) {
      const urlMatches = await db.query(
        `
        SELECT s.* FROM signal_sources s
        JOIN signal_source_identifiers i ON i.source_id = s.id
        WHERE s.workspace_id = $1 AND i.value = $2
        `,
        [workspaceId, candidate.url]
      );
      exactMatches.push(...urlMatches.rows.map((r) => ({ source: r, matchType: 'url' })));
    }

    if (candidate.name) {
      const nameMatches = await db.query(
        `
        SELECT * FROM signal_sources
        WHERE workspace_id = $1 AND lower(name) = lower($2)
        `,
        [workspaceId, candidate.name]
      );
      exactMatches.push(...nameMatches.rows.map((r) => ({ source: r, matchType: 'name' })));
    }

    // Fuzzy matches on identifier similarity
    const fuzzy = await db.query(
      `
      SELECT s.*, 1 AS similarity
      FROM signal_sources s
      WHERE s.workspace_id = $1
        AND s.type = $2
        AND s.url IS NOT NULL
      `,
      [workspaceId, candidate.type]
    );

    return {
      exact: exactMatches,
      potential: fuzzy.rows,
    };
  }

  return {
    findDuplicates,
  };
}

export default createDuplicateDetectionService;