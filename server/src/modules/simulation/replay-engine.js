/**
 * SyncExc Server — Replay engine
 *
 * Reconstructs historical events chronologically. Supports stepping,
 * pausing, and jumping to checkpoints. Used by the market replay UI.
 */

export function createReplayEngine({
  db,
  queries,
  datasetService,
  orderSimulator,
  logger,
}) {
  const ENGINE_VERSION = 'v1';

  /**
   * Initialize a replay session for a run.
   */
  async function initialize({ run, environment, config }) {
    const events = await queries.listMarketEvents({
      datasetVersionId: config.datasetVersionId,
      instrument: config.instrument,
      startTime: config.startTime,
      endTime: config.endTime,
      limit: config.maxEvents || 1000000,
    });

    if (events.length === 0) {
      throw new Error('No events for replay');
    }

    // Persist a replay session
    const result = await db.query(
      `
      INSERT INTO simulation_replay_sessions (run_id, position, speed, state, checkpoints)
      VALUES ($1, 0, 1, 'stopped', '[]'::jsonb)
      ON CONFLICT DO NOTHING
      RETURNING *
      `,
      [run.id]
    );

    return {
      runId: run.id,
      totalEvents: events.length,
      session: result.rows[0],
    };
  }

  /**
   * Advance the replay by N events, executing each in order.
   */
  async function step({ runId, count = 1 }) {
    const session = await db.query(
      `SELECT * FROM simulation_replay_sessions WHERE run_id = $1`,
      [runId]
    );
    if (session.rows.length === 0) throw new Error('No replay session');

    const current = session.rows[0];
    const startPosition = Number(current.position);
    const run = await queries.findRunById(runId);
    const config = run.config;
    const events = await queries.listMarketEvents({
      datasetVersionId: config.datasetVersionId,
      instrument: config.instrument,
      startTime: config.startTime,
      endTime: config.endTime,
      limit: config.maxEvents || 1000000,
    });

    const end = Math.min(startPosition + count, events.length);

    for (let i = startPosition; i < end; i += 1) {
      const event = events[i];
      const market = {
        price: event.payload?.close || event.payload?.price,
        timestamp: event.occurred_at,
      };

      // Apply the strategy for the current step
      const accounts = await queries.listAccountsForEnvironment(run.environment_id);
      if (accounts.length === 0) continue;
      const account = accounts[0];

      const decision = decideReplayAction({ config, event, market, position: i });
      if (decision) {
        await orderSimulator.processOrder({
          runId,
          accountId: account.id,
          order: decision,
          market,
          config: {
            fillModel: config.fillModel || 'immediate_simplified',
            takerFeeBps: config.takerFeeBps || 10,
            slippageBps: config.slippageBps || 5,
            seed: config.randomSeed,
          },
        });
      }

      await db.tx(async (tx) => {
        await queries.insertRunStep(tx, {
          runId,
          stepIndex: i,
          eventType: event.event_type,
          state: 'replayed',
          input: { position: i },
          output: { price: market.price },
        });
      });
    }

    const updated = await db.query(
      `
      UPDATE simulation_replay_sessions
      SET position = $2, updated_at = now()
      WHERE run_id = $1
      RETURNING *
      `,
      [runId, end]
    );

    return {
      position: end,
      total: events.length,
      done: end >= events.length,
      session: updated.rows[0],
    };
  }

  function decideReplayAction({ config, event, market, position }) {
    if (config.strategy === 'buy_and_hold' && position === 0 && market.price) {
      return {
        instrument: event.instrument,
        marketType: 'spot',
        side: 'buy',
        type: 'market',
        quantity: '1',
      };
    }
    return null;
  }

  return {
    initialize,
    step,
    version: ENGINE_VERSION,
  };
}

export default createReplayEngine;