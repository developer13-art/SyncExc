/**
 * SyncExc Server — Performance reporting service
 */

import { NotFoundError } from '../../lib/errors.js';

const METHODOLOGY_VERSION = 'v1';

export function createPerformanceService({ db, queries, logger }) {
  /**
   * Compute a performance report for a provider over a period.
   */
  async function computeReport({ providerId, periodStart, periodEnd }) {
    const provider = await queries.findProviderById(providerId);
    if (!provider) throw new NotFoundError('Provider');

    // Gather published signals in the period
    const signalsResult = await db.query(
      `
      SELECT status, count(*)::int AS count
      FROM marketplace_published_signals
      WHERE provider_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY status
      `,
      [providerId, periodStart, periodEnd]
    );

    const signalsByStatus = signalsResult.rows.reduce((acc, r) => {
      acc[r.status] = r.count;
      return acc;
    }, {});

    // Observation data
    const observationsResult = await db.query(
      `
      SELECT outcome, count(*)::int AS count
      FROM marketplace_performance_observations o
      JOIN marketplace_published_signals s ON s.id = o.signal_id
      WHERE s.provider_id = $1
        AND o.observed_at >= $2
        AND o.observed_at <= $3
      GROUP BY outcome
      `,
      [providerId, periodStart, periodEnd]
    );

    const observationsByOutcome = observationsResult.rows.reduce((acc, r) => {
      acc[r.outcome || 'unknown'] = r.count;
      return acc;
    }, {});

    const totalPublished = Object.values(signalsByStatus).reduce((a, b) => a + b, 0);
    const totalObserved = Object.values(observationsByOutcome).reduce((a, b) => a + b, 0);

    // Data completeness: how many signals have observations?
    const completeness = {
      totalPublished,
      totalObserved,
      completenessPct: totalPublished > 0 ? ((totalObserved / totalPublished) * 100).toFixed(2) : null,
    };

    const metrics = {
      signalsByStatus,
      observationsByOutcome,
      totalPublished,
      totalObserved,
    };

    return db.tx(async (tx) => {
      const report = await queries.insertPerformanceReport(tx, {
        providerId,
        methodologyVersion: METHODOLOGY_VERSION,
        periodStart,
        periodEnd,
        metrics,
        completeness,
      });
      return report;
    });
  }

  async function recordObservation({ signalId, outcome, evidence, observedAt }) {
    return queries.insertPerformanceObservation(null, {
      signalId,
      observedAt: observedAt || new Date(),
      outcome,
      evidence,
    });
  }

  async function listReports({ providerId, limit }) {
    return queries.listPerformanceReports(providerId, { limit });
  }

  return {
    computeReport,
    recordObservation,
    listReports,
  };
}

export default createPerformanceService;