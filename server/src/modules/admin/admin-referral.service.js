/**
 * SyncExc Server — Admin referral service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAdminReferralService({ db, queries, referral, approvals, events, audit, logger }) {
  async function listPolicies() {
    const result = await db.query(
      `
      SELECT p.*,
        (SELECT row_to_json(v) FROM (
          SELECT * FROM commission_policy_versions
          WHERE policy_id = p.id ORDER BY version DESC LIMIT 1
        ) v) AS latest_version
      FROM commission_policies p
      ORDER BY p.created_at DESC
      `
    );
    return result.rows;
  }

  async function createPolicyDraft({ userId, name, config, effectiveFrom }) {
    return referral.commissionPolicy.createPolicy({
      userId,
      name,
      config,
      effectiveFrom,
    }).then((result) => {
      return audit.write({
        actorId: userId,
        action: 'referral_policy.draft_created',
        targetResource: 'commission_policy',
        targetId: result.policy.id,
        after: { name, config },
      }).then(() => result);
    });
  }

  async function publishPolicy({ policyId, actorId, reason }) {
    // Requires second approver
    const approval = await approvals.requestApproval({
      actionType: 'referral.policy_publish',
      actionPayload: { policyId },
      requestedBy: actorId,
      reason,
    });

    return { requiresApproval: true, approval };
  }

  async function listPayouts({ status, limit = 50, cursor = null } = {}) {
    const params = [limit + 1];
    let statusClause = '';
    if (status) {
      params.push(status);
      statusClause = `WHERE status = $${params.length}`;
    }
    if (cursor) {
      params.push(cursor);
      statusClause += statusClause ? ` AND ` : `WHERE `;
      statusClause += `created_at < $${params.length}`;
    }
    const result = await db.query(
      `
      SELECT p.*, a.user_id AS affiliate_user_id
      FROM affiliate_payout_requests p
      JOIN affiliates a ON a.id = p.affiliate_id
      ${statusClause}
      ORDER BY p.requested_at DESC
      LIMIT $1
      `,
      params
    );
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const last = rows[rows.length - 1];
    return {
      rows,
      nextCursor: hasMore && last ? last.requested_at.toISOString() : null,
    };
  }

  async function reviewPayout({ payoutId, actorId, decision, reason }) {
    const payout = await db.query(
      `SELECT * FROM affiliate_payout_requests WHERE id = $1`,
      [payoutId]
    );
    if (payout.rows.length === 0) throw new NotFoundError('Payout');

    if (decision === 'approve') {
      await db.query(
        `UPDATE affiliate_payout_requests SET status = 'approved', approved_at = now() WHERE id = $1`,
        [payoutId]
      );

      // Trigger processing
      await referral.payout.processPayoutRequest(payoutId);

      await audit.write({
        actorId,
        action: 'payout.approved',
        targetResource: 'affiliate_payout',
        targetId: payoutId,
        reason,
      });
    } else {
      await db.query(
        `UPDATE affiliate_payout_requests SET status = 'rejected' WHERE id = $1`,
        [payoutId]
      );
      await audit.write({
        actorId,
        action: 'payout.rejected',
        targetResource: 'affiliate_payout',
        targetId: payoutId,
        reason,
      });
    }

    return { ok: true };
  }

  async function listFraudCases({ state, limit = 50 } = {}) {
    const params = [limit];
    let stateClause = '';
    if (state) {
      params.push(state);
      stateClause = `WHERE state = $${params.length}`;
    }
    const result = await db.query(
      `
      SELECT f.*, a.user_id AS affiliate_user_id
      FROM affiliate_fraud_cases f
      JOIN affiliates a ON a.id = f.affiliate_id
      ${stateClause}
      ORDER BY f.opened_at DESC
      LIMIT $1
      `,
      params
    );
    return result.rows;
  }

  async function decideFraudCase({ caseId, actorId, decision, reason }) {
    return referral.fraud.decideCase({
      caseId,
      actorId,
      decision,
      reason,
    });
  }

  return {
    listPolicies,
    createPolicyDraft,
    publishPolicy,
    listPayouts,
    reviewPayout,
    listFraudCases,
    decideFraudCase,
  };
}

export default createAdminReferralService;