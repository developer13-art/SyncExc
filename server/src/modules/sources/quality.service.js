/**
 * SyncExc Server — Source quality service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createQualityService({ db, queries, logger }) {
  /**
   * Record that a message was ingested from a source. Aggregated into
   * quality snapshots on a schedule.
   */
  async function recordMessageIngested({ sourceId, valid = true, duplicate = false }) {
    await queries.insertObservation(db, {
      sourceId,
      eventCount: 1,
      validCount: valid && !duplicate ? 1 : 0,
      invalidCount: !valid ? 1 : 0,
      duplicateCount: duplicate ? 1 : 0,
    });
  }

  /**
   * Compute a quality snapshot for a source over the last window.
   */
  async function evaluateSource({ sourceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source) throw new NotFoundError('Source');

    const result = await db.query(
      `
      SELECT
        count(*)::int AS event_count,
        COALESCE(sum(valid_count), 0)::int AS valid_count,
        COALESCE(sum(invalid_count), 0)::int AS invalid_count,
        COALESCE(sum(duplicate_count), 0)::int AS duplicate_count
      FROM signal_source_observations
      WHERE source_id = $1
        AND observed_at >= now() - interval '7 days'
      `,
      [sourceId]
    );

    const row = result.rows[0];
    const total = row.event_count || 0;

    let qualityState = 'insufficient_data';
    if (total >= 10) {
      const invalidRate = row.invalid_count / total;
      const duplicateRate = row.duplicate_count / total;
      if (invalidRate < 0.1 && duplicateRate < 0.1) {
        qualityState = 'established';
      } else if (invalidRate < 0.3 && duplicateRate < 0.3) {
        qualityState = 'under_observation';
      } else {
        qualityState = 'degraded';
      }
    }

    await db.tx(async (tx) => {
      await queries.insertQualitySnapshot(tx, {
        sourceId,
        sampleCount: total,
        parsingSuccess: total > 0 ? ((row.valid_count / total) * 100).toFixed(2) : null,
        invalidRate: total > 0 ? ((row.invalid_count / total) * 100).toFixed(2) : null,
        duplicateRate: total > 0 ? ((row.duplicate_count / total) * 100).toFixed(2) : null,
        observationStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        observationEnd: new Date(),
      });

      await queries.updateSource(sourceId, { qualityState });
    });

    return { qualityState, sampleCount: total };
  }

  async function getQuality({ sourceId, workspaceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Source');
    const snapshot = await queries.getLatestQualitySnapshot(sourceId);
    return { snapshot };
  }

  return {
    recordMessageIngested,
    evaluateSource,
    getQuality,
  };
}

export default createQualityService;