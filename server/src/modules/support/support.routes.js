/**
 * SyncExc Server — Support routes
 */

import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { UuidSchema, PaginationSchema } from '@syncexc/shared';
import { createSupportController } from './support.controller.js';

// In-memory storage for multer; the file is then handed to the storage driver
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const CreateTicketSchema = Joi.object({
  subject: Joi.string().trim().min(3).max(200).required(),
  category: Joi.string().required(),
  issueType: Joi.string().trim().max(100).optional(),
  description: Joi.string().trim().min(20).max(20000).required(),
  affectedWorkspaceId: UuidSchema.optional(),
  affectedResource: Joi.object({
    type: Joi.string().required(),
    id: Joi.string().required(),
  }).optional(),
  occurrenceTime: Joi.date().iso().optional(),
  impact: Joi.string().trim().max(2000).optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional(),
  preferredLanguage: Joi.string().max(8).default('en'),
});

const UpdateTicketSchema = Joi.object({
  subject: Joi.string().trim().min(3).max(200).optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional(),
  status: Joi.string().valid(
    'new', 'open', 'assigned', 'in_progress', 'waiting_for_customer',
    'waiting_for_internal_team', 'escalated', 'resolved', 'closed', 'reopened', 'canceled'
  ).optional(),
  reason: Joi.string().max(500).optional(),
}).min(1);

const TransitionSchema = Joi.object({
  status: Joi.string().valid(
    'open', 'assigned', 'in_progress', 'waiting_for_customer',
    'waiting_for_internal_team', 'escalated', 'resolved', 'closed', 'reopened', 'canceled'
  ).required(),
  reason: Joi.string().max(500).required(),
  asAgent: Joi.boolean().default(false),
});

const ReopenSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
});

const ReplySchema = Joi.object({
  message: Joi.string().trim().min(1).max(20000).required(),
  attachmentIds: Joi.array().items(UuidSchema).max(10).optional(),
});

const InternalNoteSchema = Joi.object({
  content: Joi.string().trim().min(1).max(20000).required(),
  mentions: Joi.array().items(UuidSchema).max(20).optional(),
});

const AssignSchema = Joi.object({
  assignedToId: UuidSchema.optional(),
  queueId: UuidSchema.optional(),
}).or('assignedToId', 'queueId');

const EscalateSchema = Joi.object({
  category: Joi.string()
    .valid('technical', 'execution_integrity', 'risk_safety', 'security', 'billing', 'developer_integration', 'platform_incident')
    .required(),
  escalatedTo: UuidSchema.optional(),
  reason: Joi.string().min(10).max(2000).required(),
});

const DiagnosticSchema = Joi.object({
  diagnosticType: Joi.string()
    .valid('connection_health', 'order_status', 'sync_status', 'webhook_delivery_status', 'subscription_status')
    .required(),
  scope: Joi.object().unknown(true).required(),
});

const ArticleFeedbackSchema = Joi.object({
  helpful: Joi.boolean().required(),
  comment: Joi.string().max(2000).optional(),
});

const TicketFeedbackSchema = Joi.object({
  score: Joi.number().integer().min(1).max(5).optional(),
  comment: Joi.string().max(2000).optional(),
  issueResolved: Joi.boolean().optional(),
});

export function createSupportRoutes(services) {
  const controller = createSupportController(services);
  const { middleware } = services;
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Customer endpoints
   * ------------------------------------------------------------------------ */
  router.get(
    '/categories',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listCategories)
  );

  router.get(
    '/tickets',
    middleware.requireAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listMyTickets)
  );

  router.post(
    '/tickets',
    middleware.requireAuth(),
    middleware.validateBody(CreateTicketSchema),
    middleware.asyncHandler(controller.createTicket)
  );

  router.get(
    '/tickets/:ticketId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getTicket)
  );

  router.patch(
    '/tickets/:ticketId',
    middleware.requireAuth(),
    middleware.validateBody(UpdateTicketSchema),
    middleware.asyncHandler(controller.updateTicket)
  );

  router.post(
    '/tickets/:ticketId/reopen',
    middleware.requireAuth(),
    middleware.validateBody(ReopenSchema),
    middleware.asyncHandler(controller.reopenTicket)
  );

  /* Messages */
  router.get(
    '/tickets/:ticketId/messages',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listMessages)
  );

  router.post(
    '/tickets/:ticketId/messages',
    middleware.requireAuth(),
    middleware.validateBody(ReplySchema),
    middleware.asyncHandler(controller.postCustomerReply)
  );

  /* Attachments */
  router.get(
    '/tickets/:ticketId/attachments',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listAttachments)
  );

  router.post(
    '/tickets/:ticketId/attachments',
    middleware.requireAuth(),
    upload.single('file'),
    middleware.asyncHandler(controller.uploadAttachment)
  );

  router.get(
    '/attachments/:attachmentId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.downloadAttachment)
  );

  router.delete(
    '/attachments/:attachmentId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.removeAttachment)
  );

  /* Feedback */
  router.post(
    '/tickets/:ticketId/feedback',
    middleware.requireAuth(),
    middleware.validateBody(TicketFeedbackSchema),
    middleware.asyncHandler(controller.submitTicketFeedback)
  );

  /* Help center */
  router.get(
    '/help/articles',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listArticles)
  );

  router.get(
    '/help/articles/:slug',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.getArticle)
  );

  router.get(
    '/help/search',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.searchArticles)
  );

  router.get(
    '/help/categories',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listArticleCategories)
  );

  router.post(
    '/help/articles/:articleId/feedback',
    middleware.optionalAuth(),
    middleware.validateBody(ArticleFeedbackSchema),
    middleware.asyncHandler(controller.submitArticleFeedback)
  );

  /* ---------------------------------------------------------------------------
   * Agent endpoints
   * ------------------------------------------------------------------------ */
  router.get(
    '/agent/queues',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listAgentQueues)
  );

  router.get(
    '/agent/tickets',
    middleware.requireAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listAgentTickets)
  );

  router.post(
    '/agent/tickets/:ticketId/assign',
    middleware.requireAuth(),
    middleware.validateBody(AssignSchema),
    middleware.asyncHandler(controller.assignTicket)
  );

  router.post(
    '/agent/tickets/:ticketId/claim',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.claimTicket)
  );

  router.post(
    '/agent/tickets/:ticketId/release',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.releaseTicket)
  );

  router.post(
    '/agent/tickets/:ticketId/status',
    middleware.requireAuth(),
    middleware.validateBody(TransitionSchema),
    middleware.asyncHandler(controller.transitionStatus)
  );

  router.post(
    '/agent/tickets/:ticketId/messages',
    middleware.requireAuth(),
    middleware.validateBody(ReplySchema),
    middleware.asyncHandler(controller.postAgentReply)
  );

  router.post(
    '/agent/tickets/:ticketId/internal-notes',
    middleware.requireAuth(),
    middleware.validateBody(InternalNoteSchema),
    middleware.asyncHandler(controller.addInternalNote)
  );

  router.get(
    '/agent/tickets/:ticketId/internal-notes',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listInternalNotes)
  );

  router.post(
    '/agent/tickets/:ticketId/escalate',
    middleware.requireAuth(),
    middleware.validateBody(EscalateSchema),
    middleware.asyncHandler(controller.escalateTicket)
  );

  router.post(
    '/agent/tickets/:ticketId/diagnostics',
    middleware.requireAuth(),
    middleware.validateBody(DiagnosticSchema),
    middleware.asyncHandler(controller.runDiagnostic)
  );

  router.get(
    '/agent/tickets/:ticketId/diagnostics',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listDiagnosticRuns)
  );

  router.get(
    '/agent/metrics',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getMetrics)
  );

  /* AI assist */
  router.post(
    '/agent/tickets/:ticketId/ai/suggest-articles',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.aiSuggestArticles)
  );

  router.post(
    '/agent/tickets/:ticketId/ai/summarize',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.aiSummarize)
  );

  router.post(
    '/agent/tickets/:ticketId/ai/draft',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.aiDraft)
  );

  router.post(
    '/agent/tickets/:ticketId/ai/detect-duplicate',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.aiDetectDuplicate)
  );

  return router;
}

export default createSupportRoutes;