/**
 * SyncExc Server — Signals controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeSignalCandidate, serializeSignalMessage } from '../../lib/serializers.js';
import { AuthorizationError } from '../../lib/errors.js';

export function createSignalsController(services) {
  const { ingestion, extraction, review, validation, eligibility, intentHandoff, sourceAccess } = services;

  async function requireCandidateInWorkspace(candidateId, workspaceId) {
    const result = await extraction.getCandidate(candidateId);
    const candidate = result?.candidate ?? result;
    if (!candidate?.source_id) throw new AuthorizationError('Signal candidate is unavailable');
    const source = await sourceAccess.getSourceForWorkspace({
      sourceId: candidate.source_id,
      workspaceId,
    });
    if (source.workspace_id !== workspaceId) {
      throw new AuthorizationError('Signal candidate belongs to a different workspace');
    }
    return result;
  }

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
          sourceId: req.query.sourceId,
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
      const result = await requireCandidateInWorkspace(req.params.candidateId, req.workspace.id);
      return success(res, {
        candidate: serializeSignalCandidate(result.candidate),
        targets: result.targets,
        issues: result.issues,
        relationships: result.relationships,
      });
    },

    async submitReview(req, res) {
      await requireCandidateInWorkspace(req.body.candidateId, req.workspace.id);
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
      await requireCandidateInWorkspace(req.params.candidateId, req.workspace.id);
      const result = await validation.validateCandidate({
        candidateId: req.params.candidateId,
      });
      return success(res, result);
    },

    async decideEligibility(req, res) {
      await requireCandidateInWorkspace(req.params.candidateId, req.workspace.id);
      const result = await eligibility.decideEligibility({
        candidateId: req.params.candidateId,
      });
      return success(res, result);
    },

    async createIntent(req, res) {
      if (req.body.workspaceId && req.body.workspaceId !== req.workspace.id) {
        throw new AuthorizationError('Request workspace does not match the active workspace');
      }
      const intent = await intentHandoff.createIntent({
        userId: req.auth.userId,
        candidateId: req.body.signalId,
        workspaceId: req.workspace.id,
        syncGroupId: req.body.syncGroupId,
        executionMode: req.body.executionMode,
      });
      return created(res, intent);
    },

    async getIntent(req, res) {
      const intent = await intentHandoff.getIntent({
        workspaceId: req.workspace.id,
        intentId: req.params.intentId,
      });
      return success(res, intent);
    },

    async cancelIntent(req, res) {
      const intent = await intentHandoff.cancelIntent({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        intentId: req.params.intentId,
        reason: req.body.reason,
      });
      return success(res, intent);
    },
  };
}

export default createSignalsController;