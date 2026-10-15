/**
 * SyncExc Server — Replay service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createReplayService({ db, queries, replayEngine, logger }) {
  async function startReplay({ userId, workspaceId, environmentId, config }) {
    const environment = await queries.findEnvironmentById(environmentId);
    if (!environment || environment.workspace_id !== workspaceId) {
      throw new NotFoundError('Environment');
    }
    if (environment.type !== 'market_replay') {
      throw new NotFoundError('Replay environment');
    }

    const run = await db.tx(async (tx) => {
      return queries.insertRun(tx, {
        environmentId,
        version: environment.current_version,
        state: 'running',
        config,
        randomSeed: config.randomSeed || null,
        engineVersion: replayEngine.version,
        createdBy: userId,
      });
    });

    const session = await replayEngine.initialize({
      run,
      environment,
      config,
    });

    await queries.updateRun(run.id, { startedAt: new Date() });

    return { run, session };
  }

  async function stepReplay({ runId, count }) {
    return replayEngine.step({ runId, count });
  }

  async function getSession({ runId, workspaceId }) {
    const run = await queries.findRunById(runId);
    if (!run) throw new NotFoundError('Run');
    const environment = await queries.findEnvironmentById(run.environment_id);
    if (!environment || environment.workspace_id !== workspaceId) {
      throw new NotFoundError('Run');
    }

    const result = await db.query(
      `SELECT * FROM simulation_replay_sessions WHERE run_id = $1`,
      [runId]
    );
    return result.rows[0] || null;
  }

  return {
    startReplay,
    stepReplay,
    getSession,
  };
}

export default createReplayService;