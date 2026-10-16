/**
 * SyncExc Server — Signals controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeSignalCandidate, serializeSignalMessage } from '../../lib/serializers.js';

export function createSignalsController(services) {
  const { ingestion, extraction, review, validation, eligibility, intentHandoff } = services;

  return {
    async ingestMessage(req, res) {
      const result = await ingestion.ingestMessage({
        workspaceId: req.workspace.id,
        sourceId: req.body.sourceId,
        providerMessageId: req.body.providerMessageId,
        channelRef: req.body.channelRef,
        providerTimestamp: req.body.providerTimestamp,
        contentType: req.body.contentType,
        content: req.body.content,
        attachments: req.body.attachments,
      });
      return created(res, result);
    },

    async getMessage(req, res) {
      const message = await ingestion.getMessage({
        messageId: req.params.messageId,
        workspaceId: req.workspace.id,
      });
      return success(res, serializeSignalMessage(message));
    },

    async listMessages(req, res) {
      const messages = await ingestion.listMessagesForSource({
        sourceId: req.query.sourceId,
        workspaceId: req.workspace.id,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, messages.map(serializeSignalMessage));
    },

    async listCandidates(req, res) {
      const { rows, nextCursor } = await extraction.listCandidatesForWorkspace(
        req.workspace.id,
        {
          status: req.query.status,
          query: req.query.q,
          sort: req.query.sort,
          limit: Number(req.query.limit) || 50,
          cursor: req.query.cursor || null,
        }
      );
      return paginated(res, rows.map(serializeSignalCandidate), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async getCandidate(req, res) {
      const result = await extraction.getCandidate(req.params.candidateId);
      return success(res, {
        candidate: serializeSignalCandidate(result.candidate),
        targets: result.targets,
        issues: result.issues,
        relationships: result.relationships,
      });
    },

    async submitReview(req, res) {
      const reviewResult = await review.submitReview({
        candidateId: req.body.candidateId,
        reviewerId: req.auth.userId,
        decision: req.body.decision,
        corrections: req.body.corrections,
        reason: req.body.reason,
      });
      return created(res, reviewResult);
    },

    async validateCandidate(req, res) {
      const result = await validation.validateCandidate({
        candidateId: req.params.candidateId,
      });
      return success(res, result);
    },

    async decideEligibility(req, res) {
      const result = await eligibility.decideEligibility({
        candidateId: req.params.candidateId,
      });
      return success(res, result);
    },

    async createIntent(req, res) {
      const intent = await intentHandoff.createIntent({
        userId: req.auth.userId,
        candidateId: req.body.candidateId,
        workspaceId: req.workspace.id,
        syncGroupId: req.body.syncGroupId,
        executionMode: req.body.executionMode,
      });
      return created(res, intent);
    },

    async cancelIntent(req, res) {
      const intent = await intentHandoff.cancelIntent({
        userId: req.auth.userId,
        intentId: req.params.intentId,
        reason: req.body.reason,
      });
      return success(res, intent);
    },
  };
}

export default createSignalsController;