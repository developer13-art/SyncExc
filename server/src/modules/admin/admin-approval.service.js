/**
 * SyncExc Server — Approval service
 *
 * Enforces two-person control on configured sensitive operations. The
 * requester cannot approve their own request when separation of duties
 * is enforced.
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

const APPROVAL_TTL_MS = 60 * 60 * 1000; // 1 hour

const PROTECTED_ACTIONS = {
  'refund.initiate': { requiredPermission: 'admin.refunds.initiate', approverPermission: 'admin.refunds.approve' },
  'refund.high_value': { requiredPermission: 'admin.refunds.initiate', approverPermission: 'admin.refunds.approve', threshold: 100000 },
  'feature_flag.rollout': { requiredPermission: 'admin.feature_flags.rollout', approverPermission: 'admin.feature_flags.rollback' },
  'referral.policy_publish': { requiredPermission: 'admin.referral.policies.manage', approverPermission: 'admin.referral.policies.manage' },
  'admin.role_assign': { requiredPermission: 'admin.roles.manage', approverPermission: 'admin.roles.manage' },
  'exchange.restrict': { requiredPermission: 'admin.exchanges.restrict', approverPermission: 'admin.exchanges.restrict' },
};

export function createAdminApprovalService({ db, queries, events, logger }) {
  async function isProtected(actionType) {
    return Boolean(PROTECTED_ACTIONS[actionType]);
  }

  async function requestApproval({
    actionType,
    actionPayload,
    requestedBy,
    reason,
  }) {
    const policy = PROTECTED_ACTIONS[actionType];
    if (!policy) {
      throw new ConflictError(`Action is not protected: ${actionType}`, 'NOT_PROTECTED');
    }

    return db.tx(async (tx) => {
      const approval = await queries.insertApprovalRequest(tx, {
        actionType,
        actionPayload,
        requestedBy,
        reason,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
      });

      await events.publish(
        tx,
        'admin.approval_requested',
        {
          approvalId: approval.id,
          actionType,
          requestedBy,
        },
        {
          actorId: requestedBy,
          resourceType: 'admin_approval_request',
          resourceId: approval.id,
        }
      );

      logger.info(
        { approvalId: approval.id, actionType, requestedBy },
        'Approval requested'
      );

      return approval;
    });
  }

  async function decide({ approvalId, decidedBy, decision, reason }) {
    const approval = await queries.findApprovalRequest(approvalId);
    if (!approval) throw new NotFoundError('Approval');
    if (approval.status !== 'pending') {
      throw new ConflictError('Approval is no longer pending', 'NOT_PENDING');
    }
    if (approval.expires_at && new Date(approval.expires_at) <= new Date()) {
      await queries.updateApprovalStatus(approvalId, 'expired');
      throw new ConflictError('Approval has expired', 'APPROVAL_EXPIRED');
    }

    // Separation of duties: requester cannot approve their own request
    if (approval.requested_by === decidedBy) {
      throw new AuthorizationError(
        'You cannot approve your own request',
        'SELF_APPROVAL_FORBIDDEN'
      );
    }

    const policy = PROTECTED_ACTIONS[approval.action_type];
    if (policy) {
      const approverHasPermission = await hasPermission(decidedBy, policy.approverPermission);
      if (!approverHasPermission) {
        throw new AuthorizationError(
          `Missing approver permission: ${policy.approverPermission}`,
          'APPROVER_PERMISSION_DENIED'
        );
      }
    }

    const newStatus = decision === 'approved' ? 'approved' : 'rejected';

    return db.tx(async (tx) => {
      const decisionRecord = await queries.insertApprovalDecision(tx, {
        requestId: approvalId,
        decision,
        decidedBy,
        reason,
      });

      const updated = await queries.updateApprovalStatus(approvalId, newStatus);

      await events.publish(
        tx,
        decision === 'approved' ? 'admin.approval_granted' : 'admin.approval_rejected',
        {
          approvalId,
          actionType: approval.action_type,
          decidedBy,
        },
        {
          actorId: decidedBy,
          resourceType: 'admin_approval_request',
          resourceId: approvalId,
        }
      );

      return { approval: updated, decision: decisionRecord };
    });
  }

  async function hasPermission(userId, permission) {
    const result = await db.query(
      `
      SELECT 1 FROM admin_user_role_assignments a
      JOIN admin_role_permissions rp ON rp.role_id = a.role_id
      JOIN admin_permission_definitions p ON p.id = rp.permission_id
      WHERE a.user_id = $1
        AND a.revoked_at IS NULL
        AND (p.permission_key = $2 OR p.permission_key = '*')
      LIMIT 1
      `,
      [userId, permission]
    );
    return result.rows.length > 0;
  }

  async function listPending() {
    return queries.listPendingApprovals();
  }

  return {
    isProtected,
    requestApproval,
    decide,
    listPending,
    PROTECTED_ACTIONS,
  };
}

export default createAdminApprovalService;