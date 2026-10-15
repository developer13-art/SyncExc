/**
 * SyncExc Server — Support controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeSupportTicket, serializeSupportMessage } from '../../lib/serializers.js';

export function createSupportController(services) {
  const {
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
  } = services;

  return {
    /* Categories */
    async listCategories(req, res) {
      const categories = await ticketService.listCategories();
      return success(res, categories);
    },

    /* Tickets */
    async listMyTickets(req, res) {
      const { rows, nextCursor } = await ticketService.listTicketsForRequester({
        userId: req.auth.userId,
        status: req.query.status,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeSupportTicket), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async createTicket(req, res) {
      const ticket = await ticketService.createTicket({
        userId: req.auth.userId,
        workspaceId: req.workspace?.id || req.body.affectedWorkspaceId || null,
        subject: req.body.subject,
        category: req.body.category,
        issueType: req.body.issueType,
        description: req.body.description,
        impact: req.body.impact,
        priority: req.body.priority,
        affectedResource: req.body.affectedResource,
        occurrenceTime: req.body.occurrenceTime,
        preferredLanguage: req.body.preferredLanguage,
      });
      return created(res, serializeSupportTicket(ticket));
    },

    async getTicket(req, res) {
      const ticket = await ticketService.getTicket(req.params.ticketId);
      return success(res, serializeSupportTicket(ticket));
    },

    async updateTicket(req, res) {
      const ticket = await ticketService.updateTicket({
        userId: req.auth.userId,
        ticketId: req.params.ticketId,
        updates: req.body,
      });
      return success(res, serializeSupportTicket(ticket));
    },

    async transitionStatus(req, res) {
      const ticket = await ticketService.transitionStatus({
        userId: req.auth.userId,
        ticketId: req.params.ticketId,
        newStatus: req.body.status,
        reason: req.body.reason,
        asAgent: req.body.asAgent || false,
      });
      return success(res, serializeSupportTicket(ticket));
    },

    async reopenTicket(req, res) {
      const ticket = await ticketService.reopenTicket({
        userId: req.auth.userId,
        ticketId: req.params.ticketId,
        reason: req.body.reason,
      });
      return success(res, serializeSupportTicket(ticket));
    },

    /* Messages */
    async postCustomerReply(req, res) {
      const message = await conversationService.postCustomerReply({
        userId: req.auth.userId,
        ticketId: req.params.ticketId,
        content: req.body.message,
        attachmentIds: req.body.attachmentIds,
      });
      return created(res, serializeSupportMessage(message));
    },

    async postAgentReply(req, res) {
      const message = await conversationService.postAgentReply({
        agentId: req.auth.userId,
        ticketId: req.params.ticketId,
        content: req.body.message,
      });
      return created(res, serializeSupportMessage(message));
    },

    async listMessages(req, res) {
      const messages = await conversationService.listMessages({
        ticketId: req.params.ticketId,
        userId: req.auth.userId,
        asAgent: false,
      });
      return success(res, messages.map(serializeSupportMessage));
    },

    async addInternalNote(req, res) {
      const note = await conversationService.addInternalNote({
        agentId: req.auth.userId,
        ticketId: req.params.ticketId,
        content: req.body.content,
        mentions: req.body.mentions,
      });
      return created(res, note);
    },

    async listInternalNotes(req, res) {
      const notes = await conversationService.listInternalNotes({
        ticketId: req.params.ticketId,
      });
      return success(res, notes);
    },

    /* Attachments */
    async uploadAttachment(req, res) {
      const buffer = req.file?.buffer;
      if (!buffer) throw new Error('No file uploaded');
      const attachment = await attachmentService.uploadAttachment({
        userId: req.auth.userId,
        ticketId: req.params.ticketId,
        messageId: req.body.messageId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer,
      });
      return created(res, attachment);
    },

    async listAttachments(req, res) {
      const attachments = await attachmentService.listAttachments({
        ticketId: req.params.ticketId,
        userId: req.auth.userId,
        asAgent: false,
      });
      return success(res, attachments);
    },

    async downloadAttachment(req, res) {
      const download = await attachmentService.getAttachmentDownload({
        attachmentId: req.params.attachmentId,
        userId: req.auth.userId,
        asAgent: false,
      });
      res.setHeader('Content-Type', download.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(download.fileName)}"`
      );
      return res.send(download.buffer);
    },

    async removeAttachment(req, res) {
      const result = await attachmentService.removeAttachment({
        userId: req.auth.userId,
        attachmentId: req.params.attachmentId,
        asAgent: false,
      });
      return success(res, result);
    },

    /* Agent endpoints */
    async listAgentQueues(req, res) {
      const queues = await queueService.listQueuesForUser(req.auth.userId);
      return success(res, queues);
    },

    async listAgentTickets(req, res) {
      const queueIds = req.query.queueIds
        ? String(req.query.queueIds).split(',')
        : null;
      const { rows, nextCursor } = await ticketService.listTicketsForAgent({
        queueIds,
        status: req.query.status,
        priority: req.query.priority,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeSupportTicket), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async assignTicket(req, res) {
      const result = await assignmentService.assignTicket({
        ticketId: req.params.ticketId,
        assignedToId: req.body.assignedToId,
        queueId: req.body.queueId,
        assignedBy: req.auth.userId,
      });
      return success(res, {
        ticket: serializeSupportTicket(result.ticket),
        assignment: result.assignment,
      });
    },

    async claimTicket(req, res) {
      const result = await assignmentService.claimTicket({
        ticketId: req.params.ticketId,
        agentId: req.auth.userId,
      });
      return success(res, {
        ticket: serializeSupportTicket(result.ticket),
        assignment: result.assignment,
      });
    },

    async releaseTicket(req, res) {
      const ticket = await assignmentService.releaseTicket({
        ticketId: req.params.ticketId,
        agentId: req.auth.userId,
      });
      return success(res, serializeSupportTicket(ticket));
    },

    async escalateTicket(req, res) {
      const result = await escalationService.escalateTicket({
        ticketId: req.params.ticketId,
        category: req.body.category,
        escalatedTo: req.body.escalatedTo,
        reason: req.body.reason,
        actorId: req.auth.userId,
      });
      return success(res, {
        ticket: serializeSupportTicket(result.ticket),
        escalation: result.escalation,
      });
    },

    /* Diagnostics */
    async runDiagnostic(req, res) {
      const result = await diagnosticService.runDiagnostic({
        ticketId: req.params.ticketId,
        agentId: req.auth.userId,
        diagnosticType: req.body.diagnosticType,
        scope: req.body.scope,
      });
      return success(res, result);
    },

    async listDiagnosticRuns(req, res) {
      const runs = await diagnosticService.listDiagnosticRuns({
        ticketId: req.params.ticketId,
        agentId: req.auth.userId,
      });
      return success(res, runs);
    },

    /* Help center */
    async listArticles(req, res) {
      const articles = await articleService.listArticles({
        category: req.query.category,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, articles);
    },

    async getArticle(req, res) {
      const result = await articleService.getArticle({ slug: req.params.slug });
      return success(res, result);
    },

    async searchArticles(req, res) {
      const articles = await articleService.searchArticles({
        query: req.query.q || '',
        limit: Number(req.query.limit) || 20,
      });
      return success(res, articles);
    },

    async listArticleCategories(req, res) {
      const categories = await articleService.listCategories();
      return success(res, categories);
    },

    async submitArticleFeedback(req, res) {
      const result = await articleService.submitArticleFeedback({
        userId: req.auth?.userId || null,
        articleId: req.params.articleId,
        helpful: req.body.helpful,
        comment: req.body.comment,
      });
      return created(res, result);
    },

    /* Ticket feedback */
    async submitTicketFeedback(req, res) {
      const feedback = await feedbackService.submitFeedback({
        userId: req.auth.userId,
        ticketId: req.params.ticketId,
        score: req.body.score,
        comment: req.body.comment,
        issueResolved: req.body.issueResolved,
      });
      return created(res, feedback);
    },

    async listTicketFeedback(req, res) {
      const feedback = await feedbackService.listFeedback({
        ticketId: req.params.ticketId,
      });
      return success(res, feedback);
    },

    /* Metrics */
    async getMetrics(req, res) {
      const since = req.query.since ? new Date(req.query.since) : null;
      const metrics = await metricsService.getDashboardMetrics({ since });
      return success(res, metrics);
    },

    /* AI assist */
    async aiSuggestArticles(req, res) {
      const result = await aiAssistService.suggestHelpArticles({
        ticketId: req.params.ticketId,
      });
      return success(res, result);
    },

    async aiSummarize(req, res) {
      const result = await aiAssistService.summarizeConversation({
        ticketId: req.params.ticketId,
      });
      return success(res, result);
    },

    async aiDraft(req, res) {
      const result = await aiAssistService.draftResponse({
        ticketId: req.params.ticketId,
        tone: req.body.tone,
      });
      return success(res, result);
    },

    async aiDetectDuplicate(req, res) {
      const result = await aiAssistService.detectDuplicate({
        ticketId: req.params.ticketId,
      });
      return success(res, result);
    },
  };
}

export default createSupportController;