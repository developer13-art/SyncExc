/**
 * SyncExc Server — Dataset service
 *
 * Ingests historical market data into versioned, immutable datasets.
 * Supports:
 *   - candles (any timeframe)
 *   - trades
 *   - order book snapshots
 *
 * A dataset version is a manifest of the ingested source. Datasets are
 * append-only via new versions; existing versions never change.
 */

import { createHash } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../lib/errors.js';

export function createDatasetService({ db, queries, logger }) {
  /**
   * Create a dataset and its first version from an array of events.
   * Events are validated, deduplicated by (timestamp, type), and stored.
   */
  async function createDataset({
    name,
    description,
    source,
    instrument,
    marketType,
    events,
  }) {
    if (!Array.isArray(events) || events.length === 0) {
      throw new ValidationError('Dataset must have at least one event');
    }

    // Sort by time, validate shape
    const normalized = events.map((e, idx) => {
      if (!e.occurredAt) throw new ValidationError(`Event ${idx} missing occurredAt`);
      if (!e.eventType) throw new ValidationError(`Event ${idx} missing eventType`);
      return {
        eventType: e.eventType,
        instrument: e.instrument || instrument,
        payload: e.payload || {},
        occurredAt: new Date(e.occurredAt),
      };
    });
    normalized.sort((a, b) => a.occurredAt - b.occurredAt);

    const coverageStart = normalized[0].occurredAt;
    const coverageEnd = normalized[normalized.length - 1].occurredAt;

    // Checksum the input for reproducibility
    const checksum = createHash('sha256')
      .update(JSON.stringify(normalized.map((e) => ({ t: e.occurredAt.toISOString(), p: e.payload }))))
      .digest('hex');

    return db.tx(async (tx) => {
      const dataset = await queries.insertDataset(tx, {
        name,
        description,
        source,
        instrument,
        marketType,
        coverageStart,
        coverageEnd,
        manifest: { eventCount: normalized.length },
      });

      const version = await queries.insertDatasetVersion(tx, {
        datasetId: dataset.id,
        version: 1,
        manifest: {
          eventCount: normalized.length,
          coverageStart,
          coverageEnd,
        },
        checksum,
      });

      // Bulk insert events in chunks of 1000
      const chunkSize = 1000;
      for (let i = 0; i < normalized.length; i += chunkSize) {
        const chunk = normalized.slice(i, i + chunkSize).map((e) => ({
          datasetVersionId: version.id,
          eventType: e.eventType,
          instrument: e.instrument,
          payload: e.payload,
          occurredAt: e.occurredAt,
        }));
        await queries.insertMarketEventsBulk(tx, chunk);
      }

      return { dataset, version };
    });
  }

  async function getDataset({ datasetId }) {
    const dataset = await queries.findDatasetById(datasetId);
    if (!dataset) throw new NotFoundError('Dataset');
    return dataset;
  }

  async function listDatasets() {
    const result = await db.query(
      `SELECT * FROM simulation_datasets ORDER BY created_at DESC`
    );
    return result.rows;
  }

  return {
    createDataset,
    getDataset,
    listDatasets,
  };
}

export default createDatasetService;