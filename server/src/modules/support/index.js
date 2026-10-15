/**
 * SyncExc Server — Support module (Module 17)
 *
 * Owns:
 *   - support tickets and lifecycle
 *   - customer and internal conversations
 *   - secure attachments with scanning
 *   - queues, assignments, and escalation
 *   - SLA tracking with real response targets
 *   - guided diagnostics
 *   - help center articles
 *   - customer satisfaction feedback
 *   - AI-assisted support (draft suggestions, summaries, duplicate detection)
 *
 * Public API:
 *   support.ticket.create(params)
 *   support.ticket.getTicket(ticketId)
 *   support.sla.recordFirstResponse(ticketId)
 */

import { createSupportQueries } from './support.queries.js';
import { createTicketService } from './ticket.service.js';
import { createConversationService } from './conversation.service.js';
import { createAttachmentService } from './attachment.service.js';
import { createQueueService } from './queue.service.js';
import { createAssignmentService } from './assignment.service.js';
import { createEscalationService } from './escalation.js';
import { createDiagnosticService } from './diagnostics.js';
import { createArticleService } from './article.service.js';
import { createFeedbackService } from './feedback.service.js';
import { createSlaService } from './sla.service.js';
import { createMetricsService } from './metrics.service.js';
import { createAiAssistService } from './ai-assist.service.js';
import { createSupportRoutes } from './support.routes.js';
import { createSupportListeners } from './listeners.js';
import { createLogger } from '../../lib/logger.js';

export function createSupportModule({ services }) {
  const logger = createLogger({ component: 'support' });

  const queries = createSupportQueries({ db: services.db });

  const slaService = createSlaService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const ticketService = createTicketService({
    db: services.db,
    queries,
    slaService,
    events: services.events,
    realtime: services.realtime,
    logger,
  });

  const conversationService = createConversationService({
    db: services.db,
    queries,
    ticketService,
    events: services.events,
    realtime: services.realtime,
    logger,
  });

  const attachmentService = createAttachmentService({
    db: services.db,
    queries,
    storage: services.storage,
    events: services.events,
    logger,
  });

  const queueService = createQueueService({
    db: services.db,
    queries,
    logger,
  });

  const assignmentService = createAssignmentService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const escalationService = createEscalationService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const diagnosticService = createDiagnosticService({
    db: services.db,
    queries,
    services,
    logger,
  });

  const articleService = createArticleService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const feedbackService = createFeedbackService({
    db: services.db,
    queries,
    events: services.events,
    logger,
  });

  const metricsService = createMetricsService({
    db: services.db,
    queries,
    slaService,
    logger,
  });

  const aiAssistService = createAiAssistService({
    db: services.db,
    queries,
    ai: services.ai,
    logger,
  });

  const routes = createSupportRoutes({
    ticketService,
    conversationService,
    attachmentService,
    queueService,
    assignmentService,
    escalationService,
    diagnosticService,
    articleService,
    feedbackService,
    slaService,
    metricsService,
    aiAssistService,
    middleware: services.middleware,
  });

  const listeners = createSupportListeners({
    events: services.events,
    ticketService,
    slaService,
    logger,
  });

  const publicApi = {
    ticket: {
      create: (params) => ticketService.createTicket(params),
      getTicket: (ticketId) => ticketService.getTicket(ticketId),
    },
    sla: {
      recordFirstResponse: (ticketId) => slaService.recordFirstResponse(ticketId),
    },
  };

  return {
    name: 'support',
    routes,
    queries,
    ticket: ticketService,
    conversation: conversationService,
    attachment: attachmentService,
    queue: queueService,
    assignment: assignmentService,
    escalation: escalationService,
    diagnostic: diagnosticService,
    article: articleService,
    feedback: feedbackService,
    sla: slaService,
    metrics: metricsService,
    aiAssist: aiAssistService,
    publicApi,

    async shutdown() {
      logger.debug('Support module shutdown');
    },
  };
}

export default createSupportModule;