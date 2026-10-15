/**
 * SyncExc Server — Support metrics service
 */

export function createMetricsService({ db, queries, slaService, logger }) {
  async function getDashboardMetrics({ since }) {
    const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const created = await db.query(
      `SELECT count(*)::int AS count FROM support_tickets WHERE created_at >= $1`,
      [sinceDate]
    );

    const resolved = await db.query(
      `SELECT count(*)::int AS count FROM support_tickets WHERE resolved_at >= $1`,
      [sinceDate]
    );

    const byStatus = await db.query(
      `
      SELECT status, count(*)::int AS count
      FROM support_tickets
      WHERE created_at >= $1
      GROUP BY status
      `,
      [sinceDate]
    );

    const byPriority = await db.query(
      `
      SELECT priority, count(*)::int AS count
      FROM support_tickets
      WHERE status NOT IN ('resolved', 'closed', 'canceled')
      GROUP BY priority
      `,
      []
    );

    const firstResponse = await db.query(
      `
      SELECT
        COALESCE(percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60
        ), 0)::numeric(10,2) AS median_minutes,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60
        ), 0)::numeric(10,2) AS p95_minutes
      FROM support_tickets
      WHERE first_response_at IS NOT NULL AND created_at >= $1
      `,
      [sinceDate]
    );

    const resolution = await db.query(
      `
      SELECT
        COALESCE(percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60
        ), 0)::numeric(10,2) AS median_minutes
      FROM support_tickets
      WHERE resolved_at IS NOT NULL AND created_at >= $1
      `,
      [sinceDate]
    );

    const reopenRate = await db.query(
      `
      SELECT
        count(*) FILTER (WHERE status = 'reopened')::int AS reopened,
        count(*)::int AS total
      FROM support_tickets
      WHERE created_at >= $1
      `,
      [sinceDate]
    );

    const breaches = await db.query(
      `
      SELECT count(*)::int AS count
      FROM support_target_events
      WHERE event_type = 'breached' AND occurred_at >= $1
      `,
      [sinceDate]
    );

    const satisfaction = await db.query(
      `
      SELECT
        COALESCE(avg(score), 0)::numeric(3,2) AS avg_score,
        count(*)::int AS total_responses
      FROM support_feedback
      WHERE created_at >= $1 AND score IS NOT NULL
      `,
      [sinceDate]
    );

    const unassignedUrgent = await db.query(
      `
      SELECT count(*)::int AS count
      FROM support_tickets
      WHERE priority IN ('urgent', 'high')
        AND assigned_to_id IS NULL
        AND status NOT IN ('resolved', 'closed', 'canceled')
      `,
      []
    );

    const reopenTotal = reopenRate.rows[0].total || 0;
    const reopenCount = reopenRate.rows[0].reopened || 0;

    return {
      since: sinceDate.toISOString(),
      created: created.rows[0].count,
      resolved: resolved.rows[0].count,
      byStatus: byStatus.rows.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {}),
      byPriority: byPriority.rows.reduce((acc, r) => ({ ...acc, [r.priority]: r.count }), {}),
      firstResponseMinutes: {
        median: Number(firstResponse.rows[0].median_minutes),
        p95: Number(firstResponse.rows[0].p95_minutes),
      },
      resolutionMinutes: {
        median: Number(resolution.rows[0].median_minutes),
      },
      reopenRate: reopenTotal > 0 ? reopenCount / reopenTotal : 0,
      slaBreaches: breaches.rows[0].count,
      satisfaction: {
        averageScore: Number(satisfaction.rows[0].avg_score),
        totalResponses: satisfaction.rows[0].total_responses,
      },
      unassignedUrgent: unassignedUrgent.rows[0].count,
    };
  }

  return {
    getDashboardMetrics,
  };
}

export default createMetricsService;