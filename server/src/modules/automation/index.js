/**
 * SyncExc Server — Automation module (Module 11)
 *
 * Owns:
 *   - workflow definitions and versioned graphs
 *   - triggers (event-driven and scheduled)
 *   - the visual workflow engine (real graph traversal + node execution)
 *   - the node registry (all node types with real implementations)
 *   - test runs (isolated execution with real step traces)
 *   - run history and diagnostics
 *
 * Public API:
 *   automation.engine.executeRun(runId)
 *   automation.workflow.publishVersion(workflowId, definition)
 *   automation.scheduler.tick()
 */

import { createAutomationQueries } from './automation.queries.js';
import { createWorkflowService } from './workflow.service.js';
import { createVersionService } from './version.service.js';
import { createTriggerService } from './trigger.service.js';
import { createScheduleService } from './schedule.service.js';
import { createValidationService } from './validation.service.js';
import { createTestRunService } from './test-run.service.js';
import { createExecutionEngine } from './execution-engine/index.js';
import { createNodeRegistry } from './node-registry.js';
import { createPauseService } from './pause.service.js';
import { createAutomationRoutes } from './automation.routes.js';
import { createAutomationListeners } from './listeners.js';
import { createLogger } from '../../lib/logger.js';

export function createAutomationModule({ services }) {
  const logger = createLogger({ component: 'automation' });

  const queries = createAutomationQueries({ db: services.db });

  // Node registry contains every node type's execution logic
  const nodeRegistry = createNodeRegistry({
    services,
    logger,
  });

  const workflowService = createWorkflowService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const versionService = createVersionService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const validationService = createValidationService({
    db: services.db,
    queries,
    nodeRegistry,
    logger,
  });

  const triggerService = createTriggerService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const scheduleService = createScheduleService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const pauseService = createPauseService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const executionEngine = createExecutionEngine({
    db: services.db,
    queries,
    nodeRegistry,
    events: services.events,
    realtime: services.realtime,
    logger,
  });

  const testRunService = createTestRunService({
    db: services.db,
    queries,
    nodeRegistry,
    validationService,
    logger,
  });

  const routes = createAutomationRoutes({
    workflowService,
    versionService,
    triggerService,
    scheduleService,
    validationService,
    testRunService,
    executionEngine,
    pauseService,
    middleware: services.middleware,
  });

  const listeners = createAutomationListeners({
    events: services.events,
    triggerService,
    executionEngine,
    logger,
  });

  const publicApi = {
    engine: {
      executeRun: (runId) => executionEngine.executeRun(runId),
    },
    workflow: {
      publishVersion: (params) => versionService.publishVersion(params),
    },
    scheduler: {
      tick: () => scheduleService.tick(),
    },
  };

  return {
    name: 'automation',
    routes,
    queries,
    workflow: workflowService,
    version: versionService,
    trigger: triggerService,
    schedule: scheduleService,
    validation: validationService,
    testRun: testRunService,
    engine: executionEngine,
    nodeRegistry,
    pause: pauseService,
    publicApi,

    async shutdown() {
      logger.debug('Automation module shutdown');
    },
  };
}

export default createAutomationModule;