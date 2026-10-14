/**
 * SyncExc Server — Risk module (Module 07)
 *
 * Owns:
 *   - risk policies and versions
 *   - pre-trade evaluation of every trading operation
 *   - exposure calculation and reservation tracking
 *   - approval workflows
 *   - emergency pause and circuit breakers
 *   - incidents and alerts
 *
 * Public API:
 *   risk.evaluation.evaluate({ workspaceId, operationType, operationPayload })
 *   risk.requireApproval
 *   risk.emergency.isPaused({ scope, scopeRef })
 *   risk.exposure.getWorkspaceExposure(workspaceId)
 */

import { createRiskQueries } from './risk.queries.js';
import { createPolicyService } from './policy.service.js';
import { createEvaluationService } from './evaluation.service.js';
import { createReservationService } from './reservation.service.js';
import { createExposureService } from './exposure.service.js';
import { createApprovalService } from './approval.service.js';
import { createEmergencyPauseService } from './emergency-pause.service.js';
import { createCircuitBreakerService } from './circuit-breaker.service.js';
import { createIncidentService } from './incident.service.js';
import { createAlertService } from './alert.service.js';
import { createRiskRoutes } from './risk.routes.js';
import { createRuleRegistry } from './rules/index.js';
import { createLogger } from '../../lib/logger.js';

export function createRiskModule({ services }) {
  const logger = createLogger({ component: 'risk' });

  const queries = createRiskQueries({ db: services.db });

  const ruleRegistry = createRuleRegistry({ logger });

  const policyService = createPolicyService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const reservationService = createReservationService({
    db: services.db,
    queries,
    logger,
  });

  const exposureService = createExposureService({
    db: services.db,
    queries,
    reservations: reservationService,
    logger,
  });

  const evaluationService = createEvaluationService({
    db: services.db,
    queries,
    ruleRegistry,
    policyService,
    exposureService,
    reservationService,
    events: services.events,
    logger,
  });

  const approvalService = createApprovalService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const emergencyPauseService = createEmergencyPauseService({
    db: services.db,
    queries,
    realtime: services.realtime,
    events: services.events,
    logger,
  });

  const circuitBreakerService = createCircuitBreakerService({
    db: services.db,
    queries,
    emergencyPause: emergencyPauseService,
    events: services.events,
    logger,
  });

  const incidentService = createIncidentService({
    db: services.db,
    queries,
    events: services.events,
    realtime: services.realtime,
    logger,
  });

  const alertService = createAlertService({
    db: services.db,
    queries,
    events: services.events,
    realtime: services.realtime,
    logger,
  });

  const routes = createRiskRoutes({
    policyService,
    evaluationService,
    exposureService,
    approvalService,
    emergencyPauseService,
    circuitBreakerService,
    incidentService,
    alertService,
    middleware: services.middleware,
  });

  return {
    name: 'risk',
    routes,
    policy: policyService,
    evaluation: evaluationService,
    reservation: reservationService,
    exposure: exposureService,
    approval: approvalService,
    emergencyPause: emergencyPauseService,
    emergency: emergencyPauseService,
    circuitBreaker: circuitBreakerService,
    incident: incidentService,
    alert: alertService,

    async shutdown() {
      logger.debug('Risk module shutdown');
    },
  };
}

export default createRiskModule;