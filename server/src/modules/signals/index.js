/**
 * SyncExc Server — Signals module (Module 09)
 *
 * Owns:
 *   - message ingestion and normalization
 *   - deduplication and message identity
 *   - deterministic parsing and AI interpretation
 *   - structured signal extraction
 *   - ambiguity, contradiction, freshness detection
 *   - signal updates and lifecycle tracking
 *   - confidence scoring and human review
 *   - deterministic validation and eligibility
 *   - execution-intent handoff
 *
 * Public API:
 *   signals.ingestMessage(params)
 *   signals.getCandidate(candidateId)
 *   signals.listCandidatesForWorkspace(workspaceId)
 */

import { createSignalsQueries } from './signals.queries.js';
import { createIngestionService } from './ingestion.service.js';
import { createDeduplicationService } from './deduplication.service.js';
import { createParserService } from './parsers.js';
import { createAiInterpreterService } from './ai-interpreter.service.js';
import { createExtractionService } from './extraction.service.js';
import { createIssueDetectionService } from './issue-detection.service.js';
import { createUpdateTrackerService } from './update-tracker.service.js';
import { createConfidenceService } from './confidence.service.js';
import { createReviewService } from './review.service.js';
import { createValidationService } from './validation.js';
import { createEligibilityService } from './eligibility.service.js';
import { createIntentHandoffService } from './intent-handoff.service.js';
import { createSignalsRoutes } from './signals.routes.js';
import { createSignalsListeners } from './listeners.js';
import { createTelegramPollingService } from './telegram-polling.service.js';
import { createLogger } from '../../lib/logger.js';

export function createSignalsModule({ services }) {
  const logger = createLogger({ component: 'signals' });

  const queries = createSignalsQueries({ db: services.db });

  const deduplication = createDeduplicationService({
    db: services.db,
    queries,
    logger,
  });

  const ingestion = createIngestionService({
    db: services.db,
    queries,
    deduplication,
    events: services.events,
    sourceAccess: {
      getSourceForWorkspace: (params) => services.sources.getSourceForWorkspace(params),
    },
    logger,
  });

  const telegramPolling = createTelegramPollingService({
    db: services.db,
    ingestion,
    logger,
  });
  if (process.env.NODE_ENV !== 'test' && process.env.TELEGRAM_POLLING_ENABLED !== 'false') {
    telegramPolling.start();
  }

  const parser = createParserService({
    db: services.db,
    queries,
    logger,
  });

  const aiInterpreter = createAiInterpreterService({
    db: services.db,
    queries,
    ai: services.ai,
    logger,
  });

  const extraction = createExtractionService({
    db: services.db,
    queries,
    parser,
    aiInterpreter,
    logger,
  });

  const issueDetection = createIssueDetectionService({
    db: services.db,
    queries,
    logger,
  });

  const updateTracker = createUpdateTrackerService({
    db: services.db,
    queries,
    logger,
  });

  const confidence = createConfidenceService({
    db: services.db,
    queries,
    logger,
  });

  const review = createReviewService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const validation = createValidationService({
    db: services.db,
    queries,
    connections: services.connections,
    events: services.events,
    logger,
  });

  const eligibility = createEligibilityService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const intentHandoff = createIntentHandoffService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const routes = createSignalsRoutes({
    ingestion,
    extraction,
    review,
    validation,
    eligibility,
    intentHandoff,
    middleware: services.middleware,
  });

  const listeners = createSignalsListeners({
    events: services.events,
    ingestion,
    extraction,
    logger,
  });

  const publicApi = {
    ingestMessage: (params) => ingestion.ingestMessage(params),
    getCandidate: (candidateId) => extraction.getCandidate(candidateId),
    listCandidatesForWorkspace: (workspaceId) =>
      extraction.listCandidatesForWorkspace(workspaceId),
  };

  return {
    name: 'signals',
    routes,
    queries,
    ingestion,
    deduplication,
    parser,
    aiInterpreter,
    extraction,
    issueDetection,
    updateTracker,
    confidence,
    review,
    validation,
    eligibility,
    intentHandoff,
    publicApi,

    async shutdown() {
      logger.debug('Signals module shutdown');
    },
  };
}

export default createSignalsModule;