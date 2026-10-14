/**
 * SyncExc Server — Approval service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { RISK_DECISION_OUTCOME } from '@syncexc/shared';

const APPROVAL_TTL_MS = 60 * 60 * 1000; // 1 hour

export function createApprovalService({ db, queries, events, logger }) {
  async function request({ userId, workspaceId, evaluationId, operationPayload }) {
    return db.tx(async (tx) => {
      const approval = await queries.insertApprovalRequest(tx, {
        workspaceId,
        evaluationId,
        operationPayload,
        requestedBy: userId,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
      });

      await events.publish(
        tx,
        'risk.approval_requested',
        {
          approvalId: approval.id,
          evaluationId,
          operationType: operationPayload.operationType,
        },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'risk_approval_request',
          resourceId: approval.id,
        }
      );

      return approval;
    });
  }

  async function listPending({ workspaceId }) {
    return queries.listPendingApprovalRequests(workspaceId);
  }

  async function decide({ userId, workspaceId, approvalId, decision, reason }) {
    const approval = await queries.findApprovalRequestById(approvalId);
    if (!approval) throw new NotFoundError('Approval request');
    if (approval.workspace_id !== workspaceId) throw new NotFoundError('Approval request');
    if (approval.status !== 'pending') {
      throw new ConflictError('Approval request is no longer pending', 'NOT_PENDING');
    }
    if (new Date(approval.expires_at) <= new Date()) {
      await queries.updateApprovalRequestStatus(approvalId, 'expired');
      throw new ConflictError('Approval request expired', 'EXPIRED');
    }

    // Separation of duties: the requester cannot approve their own request
    if (approval.requested_by === userId) {
      throw new ConflictError(
        'You cannot approve your own request',
        'SELF_APPROVAL_FORBIDDEN'
      );
    }

    const newStatus = decision === 'approved' ? 'approved' : 'rejected';

    return db.tx(async (tx) => {
      const decisionRecord = await queries.insertApprovalDecision(tx, {
        requestId: approvalId,
        decision,
        decidedBy: userId,
        reason,
      });

      const updated = await queries.updateApprovalRequestStatus(approvalId, newStatus);

      await events.publish(
        tx,
        decision === 'approved' ? 'risk.approval_granted' : 'risk.approval_rejected',
        { approvalId, evaluationId: approval.evaluation_id, decision },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'risk_approval_request',
          resourceId: approvalId,
        }
      );

      return { approval: updated, decision: decisionRecord };
    });
  }

  return {
    request,
    listPending,
    decide,
  };
}

export default createApprovalService;