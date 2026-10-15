/**
 * SyncExc Server — Scenario service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createScenarioService({ db, queries, logger }) {
  async function createScenario({ userId, workspaceId, name, description, parameters }) {
    return db.tx(async (tx) => {
      const scenario = await queries.insertScenario(tx, {
        workspaceId,
        name,
        description,
      });

      await queries.insertScenarioVersion(tx, {
        scenarioId: scenario.id,
        version: 1,
        parameters,
      });

      return scenario;
    });
  }

  async function listScenarios({ workspaceId }) {
    return queries.listScenariosForWorkspace(workspaceId);
  }

  async function getScenario({ scenarioId, workspaceId }) {
    const scenario = await queries.findScenarioById(scenarioId);
    if (!scenario || scenario.workspace_id !== workspaceId) throw new NotFoundError('Scenario');
    const versions = await queries.listScenarioVersions(scenarioId);
    return { scenario, versions };
  }

  return {
    createScenario,
    listScenarios,
    getScenario,
  };
}

export default createScenarioService;