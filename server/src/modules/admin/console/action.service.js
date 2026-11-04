/**
 * SyncExc Server — Admin console action service
 *
 * Every action is explicitly allow-listed. Actions never place, modify or
 * close user trades, never expose credentials, and never mark money as
 * settled without a provider or bank reference plus evidence.
 */

import { randomUUID } from 'node:crypto';

import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../lib/errors.js';
import { getResource } from './registry.js';

function requireReason(body) {
  const reason = String(body?.reason || '').trim();
  if (reason.length < 10) {
    throw new ValidationError('A reason of at least 10 characters is required');
  }
  return reason;
}

function requireString(body, key, { min = 1 } = {}) {
  const value = String(body?.[key] || '').trim();
  if (value.length < min) throw new ValidationError(`${key} is required`);
  return value;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function assertStatus(value, allowed, label = 'status') {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${label} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

export function createConsoleActionService({
  db,
  audit,
  events,
  logger,
  userService,
  workspaceService,
  refundService,
  referralService,
  featureFlagService,
  operationJobService,
}) {
  async function perform({ resourceKey, actionKey, recordId, body = {}, actorId, ipAddress, userAgent }) {
    const resource = getResource(resourceKey);
    if (!resource) throw new NotFoundError('Admin resource');
    const action = resource.actions.find((entry) => entry.key === actionKey);
    if (!action) throw new NotFoundError('Admin action');

    const reason = requireReason(body);

    let result;
    switch (`${resourceKey}:${actionKey}`) {
      /* Users */
      case 'users:suspend':
        result = await userService.suspendUser({
          userId: recordId,
          actorId,
          reason,
          scope: body.scope || 'full',
          durationHours: body.durationHours,
        });
        break;
      case 'users:restore':
        result = await userService.restoreUser({ userId: recordId, actorId, reason });
        break;
      case 'users:revoke_sessions':
        result = await userService.revokeUserSessions({ userId: recordId, actorId, reason });
        break;
      case 'users:require_mfa_reset':
        result = await userService.requireMfaReset({ userId: recordId, actorId, reason });
        break;

      /* Workspaces */
      case 'workspaces:suspend':
        result = await workspaceService.suspendWorkspace({ workspaceId: recordId, actorId, reason });
        break;
      case 'workspaces:restore':
        result = await workspaceService.restoreWorkspace({ workspaceId: recordId, actorId, reason });
        break;

      case 'workspace-memberships:suspend':
      case 'workspace-memberships:activate': {
        const status = actionKey === 'suspend' ? 'suspended' : 'active';
        result = await db.tx(async (tx) => {
          const current = await tx.query(
            `SELECT * FROM workspace_memberships WHERE id = $1 FOR UPDATE`,
            [recordId],
          );
          if (!current.rows[0]) throw new NotFoundError('Workspace membership');
          const updated = await tx.query(
            `UPDATE workspace_memberships SET status = $2, updated_at = now()
              WHERE id = $1 RETURNING *`,
            [recordId, status],
          );
          await audit.write({
            actorId,
            action: `workspace_membership.${actionKey}`,
            targetResource: 'workspace_membership',
            targetId: recordId,
            reason,
            before: { status: current.rows[0].status },
            after: { status },
            ipAddress,
            userAgent,
          });
          return updated.rows[0];
        });
        break;
      }

      /* Synchronization (does not cancel exchange-accepted orders) */
      case 'sync-groups:pause':
      case 'sync-groups:resume': {
        const next = actionKey === 'pause' ? 'paused' : 'active';
        result = await db.tx(async (tx) => {
          const current = await tx.query(`SELECT * FROM sync_groups WHERE id = $1 FOR UPDATE`, [recordId]);
          if (!current.rows[0]) throw new NotFoundError('Synchronization group');
          const updated = await tx.query(
            `UPDATE sync_groups SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
            [recordId, next],
          );
          await tx.query(
            `INSERT INTO sync_pause_events (group_id, scope, action, reason, actor_id)
             VALUES ($1, 'group', $2, $3, $4)`,
            [recordId, next === 'paused' ? 'paused' : 'resumed', reason, actorId],
          );
          return updated.rows[0];
        });
        break;
      }

      /* Signal sources */
      case 'signal-sources:pause':
      case 'signal-sources:resume':
      case 'signal-sources:archive': {
        const next = { pause: 'paused', resume: 'active', archive: 'archived' }[actionKey];
        result = await db.tx(async (tx) => {
          const current = await tx.query(`SELECT * FROM signal_sources WHERE id = $1 FOR UPDATE`, [recordId]);
          if (!current.rows[0]) throw new NotFoundError('Signal source');
          const updated = await tx.query(
            `UPDATE signal_sources SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
            [recordId, next],
          );
          return updated.rows[0];
        });
        break;
      }

      /* Marketplace providers */
      case 'marketplace-providers:approve':
      case 'marketplace-providers:restrict':
      case 'marketplace-providers:suspend': {
        const state = { approve: 'approved', restrict: 'restricted', suspend: 'suspended' }[actionKey];
        const updated = await db.query(
          `UPDATE marketplace_provider_profiles
              SET moderation_state = $2, updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, state],
        );
        if (!updated.rows[0]) throw new NotFoundError('Provider');
        result = updated.rows[0];
        break;
      }

      /* Creator monetization */
      case 'creator-monetization:approve': {
        const commissionRate = body.commissionRateBps === undefined ? null : Number(body.commissionRateBps);
        if (commissionRate !== null && (!Number.isInteger(commissionRate) || commissionRate < 0 || commissionRate > 10000)) {
          throw new ValidationError('Commission rate must be between 0 and 10000 basis points');
        }
        const maxPlans = body.maxPlans === undefined ? null : Number(body.maxPlans);
        const updated = await db.query(
          `UPDATE creator_monetization_profiles
              SET state = 'approved', monetization_enabled = true, can_accept_subscribers = true,
                  commission_rate_bps = COALESCE($2, commission_rate_bps),
                  max_plans = COALESCE($3, max_plans),
                  reason = $4, reviewed_by = $5, reviewed_at = now(), updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, commissionRate, maxPlans, reason, actorId],
        );
        if (!updated.rows[0]) throw new NotFoundError('Creator monetization profile');
        result = updated.rows[0];
        break;
      }
      case 'creator-monetization:restrict':
      case 'creator-monetization:suspend':
      case 'creator-monetization:reject': {
        const state = { restrict: 'restricted', suspend: 'suspended', reject: 'rejected' }[actionKey];
        const updated = await db.query(
          `UPDATE creator_monetization_profiles
              SET state = $2, can_accept_subscribers = false,
                  monetization_enabled = CASE WHEN $2 = 'suspended' THEN false ELSE monetization_enabled END,
                  reason = $3, reviewed_by = $4, reviewed_at = now(), updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, state, reason, actorId],
        );
        if (!updated.rows[0]) throw new NotFoundError('Creator monetization profile');
        result = updated.rows[0];
        break;
      }

      /* Trader plans */
      case 'marketplace-plans:create': {
        const providerId = requireString(body, 'providerId');
        const name = requireString(body, 'name');
        const pricing = body.pricing && typeof body.pricing === 'object' ? body.pricing : null;
        if (!pricing) throw new ValidationError('pricing must be a JSON object');
        const entitlements = body.entitlements && typeof body.entitlements === 'object'
          ? body.entitlements
          : {};
        const status = assertStatus(
          requireString(body, 'status'),
          ['draft', 'active'],
          'status',
        );

        result = await db.tx(async (tx) => {
          const provider = await tx.query(
            `SELECT id FROM marketplace_provider_profiles WHERE id = $1`,
            [providerId],
          );
          if (!provider.rows[0]) throw new NotFoundError('Trader provider');

          const plan = await tx.query(
            `INSERT INTO marketplace_provider_plans
               (provider_id, name, pricing, entitlements, status, version)
             VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, 1)
             RETURNING *`,
            [providerId, name, JSON.stringify(pricing), JSON.stringify(entitlements), status],
          );
          await tx.query(
            `INSERT INTO marketplace_provider_plan_versions (plan_id, version, snapshot)
             VALUES ($1, 1, $2::jsonb)`,
            [plan.rows[0].id, JSON.stringify({
              name, pricing, entitlements, status,
              createdBy: actorId, reason,
            })],
          );
          return plan.rows[0];
        });
        break;
      }
      case 'marketplace-plans:activate':
      case 'marketplace-plans:retire': {
        const status = actionKey === 'activate' ? 'active' : 'retired';
        const updated = await db.query(
          `UPDATE marketplace_provider_plans
              SET status = $2, updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, status],
        );
        if (!updated.rows[0]) throw new NotFoundError('Trader plan');
        result = updated.rows[0];
        break;
      }

      /* Trader subscriptions */
      case 'marketplace-subscriptions:cancel':
      case 'marketplace-subscriptions:suspend':
      case 'marketplace-subscriptions:reactivate': {
        result = await db.tx(async (tx) => {
          const current = await tx.query(
            `SELECT * FROM marketplace_subscriptions WHERE id = $1 FOR UPDATE`,
            [recordId],
          );
          if (!current.rows[0]) throw new NotFoundError('Trader subscription');
          let updated;
          if (actionKey === 'cancel' && body.atPeriodEnd) {
            updated = await tx.query(
              `UPDATE marketplace_subscriptions
                  SET cancel_at_period_end = true, updated_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId],
            );
          } else if (actionKey === 'cancel') {
            updated = await tx.query(
              `UPDATE marketplace_subscriptions
                  SET status = 'canceled', canceled_at = now(), cancel_at_period_end = true, updated_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId],
            );
          } else if (actionKey === 'suspend') {
            updated = await tx.query(
              `UPDATE marketplace_subscriptions
                  SET status = 'suspended', updated_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId],
            );
          } else {
            updated = await tx.query(
              `UPDATE marketplace_subscriptions
                  SET status = 'active', canceled_at = NULL, cancel_at_period_end = false, updated_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId],
            );
          }
          await tx.query(
            `INSERT INTO marketplace_subscription_events (subscription_id, event_type, metadata)
             VALUES ($1, $2, $3::jsonb)`,
            [recordId, `admin_${actionKey}`, JSON.stringify({ reason, actorId })],
          );
          return updated.rows[0];
        });
        break;
      }

      /* Trader earnings reversal */
      case 'marketplace-earnings:reverse': {
        result = await db.tx(async (tx) => {
          const current = await tx.query(
            `SELECT * FROM marketplace_trader_earnings WHERE id = $1 FOR UPDATE`,
            [recordId],
          );
          const earning = current.rows[0];
          if (!earning) throw new NotFoundError('Trader earning');
          if (earning.status === 'reversed') throw new ConflictError('Earning is already reversed');
          const updated = await tx.query(
            `UPDATE marketplace_trader_earnings
                SET status = 'reversed', payout_note = $2
              WHERE id = $1 RETURNING *`,
            [recordId, reason],
          );
          const transactionId = randomUUID();
          const amount = Number(earning.trader_net_amount_minor);
          await tx.query(
            `INSERT INTO platform_finance_ledger
               (transaction_id, entry_sequence, entry_type, account, direction, amount_minor, currency, source_type, source_id, description, metadata, created_by)
             VALUES
               ($1, 1, 'adjustment', 'trader_payable', 'debit', $2, $3, 'marketplace_trader_earnings', $4, $5, $6::jsonb, $7),
               ($1, 2, 'adjustment', 'platform_revenue', 'credit', $2, $3, 'marketplace_trader_earnings', $4, $5, $6::jsonb, $7)`,
            [transactionId, amount, earning.currency, recordId, `Earning reversal: ${reason}`, JSON.stringify({ reason, actorId }), actorId],
          );
          return updated.rows[0];
        });
        break;
      }

      /* Payout requests */
      case 'payout-requests:approve':
      case 'payout-requests:reject': {
        result = await db.tx(async (tx) => {
          const current = await tx.query(
            `SELECT * FROM marketplace_trader_payout_requests WHERE id = $1 FOR UPDATE`,
            [recordId],
          );
          const request = current.rows[0];
          if (!request) throw new NotFoundError('Payout request');
          if (actionKey === 'approve') {
            if (!['pending', 'under_review'].includes(request.status)) {
              throw new ConflictError('Payout request is not awaiting review', 'PAYOUT_NOT_REVIEWABLE');
            }
            const updated = await tx.query(
              `UPDATE marketplace_trader_payout_requests
                  SET status = 'approved', note = $2, reviewed_by = $3, reviewed_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId, reason, actorId],
            );
            return updated.rows[0];
          }
          if (!['pending', 'under_review', 'approved'].includes(request.status)) {
            throw new ConflictError('Payout request cannot be rejected in its current state', 'PAYOUT_NOT_REJECTABLE');
          }
          await tx.query(
            `UPDATE marketplace_trader_earnings SET payout_request_id = NULL
              WHERE payout_request_id = $1 AND status = 'pending'`,
            [recordId],
          );
          const updated = await tx.query(
            `UPDATE marketplace_trader_payout_requests
                SET status = 'rejected', note = $2, reviewed_by = $3, reviewed_at = now()
              WHERE id = $1 RETURNING *`,
            [recordId, reason, actorId],
          );
          return updated.rows[0];
        });
        break;
      }
      case 'payout-requests:confirm_settlement': {
        const providerReference = requireString(body, 'providerReference', { min: 4 });
        const providerStatus = assertStatus(
          requireString(body, 'providerStatus'),
          ['successful', 'settled', 'completed'],
          'providerStatus',
        );
        const evidence = requireString(body, 'evidence', { min: 4 });
        const settledAt = new Date(body.settledAt);
        if (Number.isNaN(settledAt.getTime())) throw new ValidationError('settledAt must be a valid timestamp');
        if (settledAt.getTime() > Date.now() + 5 * 60 * 1000) {
          throw new ValidationError('Settlement timestamp cannot be in the future');
        }

        result = await db.tx(async (tx) => {
          const current = await tx.query(
            `SELECT * FROM marketplace_trader_payout_requests WHERE id = $1 FOR UPDATE`,
            [recordId],
          );
          const request = current.rows[0];
          if (!request) throw new NotFoundError('Payout request');
          if (!['pending', 'under_review', 'approved', 'processing'].includes(request.status)) {
            throw new ConflictError('Payout request is not awaiting settlement', 'PAYOUT_NOT_SETTLEABLE');
          }

          const earnings = await tx.query(
            `UPDATE marketplace_trader_earnings
                SET status = 'paid', payout_reference = $2, payout_note = $3,
                    paid_by = $4, paid_at = now()
              WHERE payout_request_id = $1 AND status = 'pending'
              RETURNING id`,
            [recordId, providerReference, reason, actorId],
          );
          if (earnings.rowCount === 0) {
            throw new ConflictError('No pending earnings are attached to this payout request', 'NO_PAYABLE_EARNINGS');
          }

          const updated = await tx.query(
            `UPDATE marketplace_trader_payout_requests
                SET status = 'paid', payout_reference = $2, note = $3,
                    reviewed_by = $4, reviewed_at = now(),
                    provider_status = $5, settlement_evidence = $6::jsonb, settled_at = $7
              WHERE id = $1 RETURNING *`,
            [recordId, providerReference, reason, actorId, providerStatus, JSON.stringify({ evidence, providerStatus }), settledAt.toISOString()],
          );

          const transactionId = randomUUID();
          const amount = Number(request.amount_minor);
          await tx.query(
            `INSERT INTO platform_finance_ledger
               (transaction_id, entry_sequence, entry_type, account, direction, amount_minor, currency, source_type, source_id, description, metadata, created_by)
             VALUES
               ($1, 1, 'payout_paid', 'trader_payable', 'debit', $2, $3, 'marketplace_trader_payout_requests', $4, $5, $6::jsonb, $7),
               ($1, 2, 'payout_paid', 'payout_clearing', 'credit', $2, $3, 'marketplace_trader_payout_requests', $4, $5, $6::jsonb, $7)`,
            [transactionId, amount, request.currency, recordId, `Provider settlement ${providerReference}`, JSON.stringify({ providerReference, providerStatus, evidence }), actorId],
          );

          return updated.rows[0];
        });
        break;
      }

      /* Referral payouts */
      case 'referral-payouts:approve':
      case 'referral-payouts:reject':
        if (!referralService?.reviewPayout) throw new ConflictError('Referral payouts are unavailable');
        result = await referralService.reviewPayout({
          payoutId: recordId,
          actorId,
          decision: actionKey === 'approve' ? 'approve' : 'reject',
          reason,
        });
        break;

      /* Refunds */
      case 'refunds:approve':
        result = await refundService.processApprovedRefund({ refundId: recordId, actorId, reason });
        break;
      case 'refunds:reject':
        result = await refundService.rejectRefundRecord({ refundId: recordId, actorId, reason });
        break;

      /* Campaigns */
      case 'campaigns:create': {
        const name = requireString(body, 'name');
        const campaignType = assertStatus(
          requireString(body, 'campaignType'),
          ['platform', 'trader', 'referral'],
          'campaignType',
        );
        const discountType = assertStatus(
          requireString(body, 'discountType'),
          ['percentage', 'fixed'],
          'discountType',
        );
        const discountValue = Number(body.discountValue);
        if (!Number.isFinite(discountValue) || discountValue < 0) {
          throw new ValidationError('discountValue must be a non-negative number');
        }
        if (discountType === 'percentage' && discountValue > 100) {
          throw new ValidationError('Percentage discounts cannot exceed 100');
        }
        const funder = assertStatus(
          requireString(body, 'funder'),
          ['platform', 'trader'],
          'funder',
        );
        const status = assertStatus(
          requireString(body, 'status'),
          ['draft', 'pending'],
          'status',
        );
        const providerId = body.providerId ? String(body.providerId).trim() : null;
        if (campaignType === 'trader' && !providerId) {
          throw new ValidationError('providerId is required for trader campaigns');
        }
        let currency = body.currency ? String(body.currency).trim().toUpperCase() : null;
        if (discountType === 'fixed') {
          if (!currency || currency.length !== 3) {
            throw new ValidationError('currency is required for fixed discounts');
          }
        } else {
          currency = currency || null;
        }
        const code = body.code ? String(body.code).trim().toUpperCase() : null;
        if (code) {
          const existing = await db.query(
            `SELECT id FROM monetization_campaigns WHERE upper(code) = $1`,
            [code],
          );
          if (existing.rows[0]) throw new ConflictError('A campaign with that code already exists');
        }
        const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
        if (Number.isNaN(startsAt.getTime())) throw new ValidationError('startsAt is invalid');
        const endsAt = body.endsAt ? new Date(body.endsAt) : null;
        if (endsAt && Number.isNaN(endsAt.getTime())) throw new ValidationError('endsAt is invalid');
        if (endsAt && endsAt <= startsAt) throw new ValidationError('endsAt must be after startsAt');
        const maxRedemptions = body.maxRedemptions === undefined || body.maxRedemptions === ''
          ? null
          : Number(body.maxRedemptions);
        if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0)) {
          throw new ValidationError('maxRedemptions must be a positive integer');
        }

        result = await db.query(
          `INSERT INTO monetization_campaigns
             (name, campaign_type, provider_id, description, discount_type, discount_value,
              currency, code, starts_at, ends_at, max_redemptions, funder, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING *`,
          [
            name, campaignType, campaignType === 'trader' ? providerId : null,
            body.description || null, discountType, discountValue, currency, code,
            startsAt.toISOString(), endsAt ? endsAt.toISOString() : null,
            maxRedemptions, funder, status, actorId,
          ],
        );
        break;
      }
      case 'campaigns:approve':
      case 'campaigns:reject':
      case 'campaigns:pause':
      case 'campaigns:end': {
        const state = { approve: 'active', reject: 'rejected', pause: 'paused', end: 'ended' }[actionKey];
        const updated = await db.query(
          `UPDATE monetization_campaigns
              SET status = $2,
                  approved_by = CASE WHEN $2 = 'active' THEN $3 ELSE approved_by END,
                  approved_at = CASE WHEN $2 = 'active' THEN now() ELSE approved_at END,
                  updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, state, actorId],
        );
        if (!updated.rows[0]) throw new NotFoundError('Campaign');
        result = updated.rows[0];
        break;
      }

      /* Content pages */
      case 'content-pages:publish':
      case 'content-pages:archive': {
        result = await db.tx(async (tx) => {
          const current = await tx.query(`SELECT * FROM platform_content_pages WHERE id = $1 FOR UPDATE`, [recordId]);
          if (!current.rows[0]) throw new NotFoundError('Content page');
          const page = current.rows[0];
          if (actionKey === 'publish') {
            const nextVersion = Number(page.version) + 1;
            await tx.query(
              `INSERT INTO platform_content_versions (page_id, version, title, body, status, changed_by, change_reason)
               VALUES ($1, $2, $3, $4, 'published', $5, $6)`,
              [page.id, nextVersion, page.title, page.body, actorId, reason],
            );
            const updated = await tx.query(
              `UPDATE platform_content_pages
                  SET status = 'published', version = $2, published_at = now(), published_by = $3, updated_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId, nextVersion, actorId],
            );
            return updated.rows[0];
          }
          const updated = await tx.query(
            `UPDATE platform_content_pages
                SET status = 'archived', archived_at = now(), updated_at = now()
              WHERE id = $1 RETURNING *`,
            [recordId],
          );
          return updated.rows[0];
        });
        break;
      }

      /* Announcements */
      case 'announcements:schedule':
      case 'announcements:send':
      case 'announcements:cancel': {
        result = await db.tx(async (tx) => {
          const current = await tx.query(`SELECT * FROM platform_announcements WHERE id = $1 FOR UPDATE`, [recordId]);
          if (!current.rows[0]) throw new NotFoundError('Announcement');
          const announcement = current.rows[0];

          if (actionKey === 'schedule') {
            const scheduledAt = new Date(body.scheduledAt);
            if (Number.isNaN(scheduledAt.getTime())) throw new ValidationError('scheduledAt must be a valid timestamp');
            const updated = await tx.query(
              `UPDATE platform_announcements
                  SET status = 'scheduled', scheduled_at = $2, updated_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId, scheduledAt.toISOString()],
            );
            return updated.rows[0];
          }

          if (actionKey === 'cancel') {
            const updated = await tx.query(
              `UPDATE platform_announcements
                  SET status = 'cancelled', updated_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId],
            );
            return updated.rows[0];
          }

          if (announcement.status === 'sent') throw new ConflictError('Announcement has already been sent');

          let recipients = [];
          if (announcement.audience === 'selected') {
            recipients = Array.isArray(announcement.audience_filter?.userIds)
              ? announcement.audience_filter.userIds.filter(Boolean)
              : [];
          } else if (announcement.audience === 'workspace_type' && announcement.audience_filter?.workspaceType) {
            const rows = await tx.query(
              `SELECT DISTINCT m.user_id
                 FROM workspace_memberships m
                 JOIN workspaces w ON w.id = m.workspace_id
                WHERE w.type = $1 AND m.status = 'active' AND w.status = 'active'
                LIMIT 10000`,
              [announcement.audience_filter.workspaceType],
            );
            recipients = rows.rows.map((row) => row.user_id);
          } else if (announcement.audience === 'subscription') {
            const rows = await tx.query(
              `SELECT DISTINCT billing_scope_id AS user_id
                 FROM subscriptions
                WHERE status = 'active' AND billing_scope_type = 'user'
                LIMIT 10000`,
            );
            recipients = rows.rows.map((row) => row.user_id);
          } else {
            const rows = await tx.query(
              `SELECT id FROM users WHERE status = 'active' AND deleted_at IS NULL LIMIT 10000`,
            );
            recipients = rows.rows.map((row) => row.id);
          }

          const event = await tx.query(
            `INSERT INTO notification_events (event_type, schema_version, payload, actor_id, resource_type, resource_id)
             VALUES ('platform.announcement', '1.0', $1::jsonb, $2, 'platform_announcements', $3)
             RETURNING id`,
            [JSON.stringify({ title: announcement.title, audience: announcement.audience }), actorId, recordId],
          );

          let delivered = 0;
          for (const userId of recipients) {
            await tx.query(
              `INSERT INTO notifications
                 (user_id, event_id, event_type, category, priority, title, message, status, created_at)
               VALUES ($1, $2, 'platform.announcement', 'platform', 'normal', $3, $4, 'delivered', now())`,
              [userId, event.rows[0].id, announcement.title, announcement.body],
            );
            delivered += 1;
          }

          const updated = await tx.query(
            `UPDATE platform_announcements
                SET status = 'sent', sent_at = now(), recipient_count = $2, updated_at = now()
              WHERE id = $1 RETURNING *`,
            [recordId, delivered],
          );
          return updated.rows[0];
        });
        break;
      }

      /* Platform settings */
      case 'platform-settings:update': {
        result = await db.tx(async (tx) => {
          const current = await tx.query(`SELECT * FROM platform_settings WHERE id = $1 FOR UPDATE`, [recordId]);
          if (!current.rows[0]) throw new NotFoundError('Platform setting');
          const setting = current.rows[0];
          const nextVersion = Number(setting.version) + 1;
          await tx.query(
            `INSERT INTO platform_setting_versions (setting_key, version, value, changed_by, reason)
             VALUES ($1, $2, $3::jsonb, $4, $5)`,
            [setting.key, nextVersion, JSON.stringify(body.value), actorId, reason],
          );
          const updated = await tx.query(
            `UPDATE platform_settings
                SET value = $3::jsonb, version = $2, updated_by = $4, updated_at = now()
              WHERE id = $1 RETURNING *`,
            [recordId, nextVersion, JSON.stringify(body.value), actorId],
          );
          return updated.rows[0];
        });
        break;
      }

      /* Financial adjustments */
      case 'finance-adjustments:create': {
        const account = requireString(body, 'account');
        const adjustmentType = assertStatus(
          requireString(body, 'adjustmentType'),
          ['credit', 'debit', 'reversal'],
          'adjustmentType',
        );
        const amountMinor = Number(body.amountMinor);
        if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
          throw new ValidationError('amountMinor must be a positive integer');
        }
        const currency = requireString(body, 'currency').toUpperCase();
        if (currency.length !== 3) throw new ValidationError('currency must be a 3-letter code');

        result = await db.tx(async (tx) => {
          const transactionId = randomUUID();
          const adjustment = await tx.query(
            `INSERT INTO finance_adjustments
               (transaction_id, adjustment_type, account, amount_minor, currency, reason, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [transactionId, adjustmentType, account, amountMinor, currency, reason, actorId],
          );
          const direction = adjustmentType === 'debit' ? 'debit' : 'credit';
          await tx.query(
            `INSERT INTO platform_finance_ledger
               (transaction_id, entry_sequence, entry_type, account, direction, amount_minor, currency, source_type, source_id, description, metadata, created_by)
             VALUES ($1, 1, 'adjustment', $2, $3, $4, $5, 'finance_adjustments', $6, $7, $8::jsonb, $9)`,
            [transactionId, account, direction, amountMinor, currency, adjustment.rows[0].id, `Financial adjustment: ${reason}`, JSON.stringify({ reason, actorId }), actorId],
          );
          return adjustment.rows[0];
        });
        break;
      }

      /* Commission rules */
      case 'commission-rules:activate':
      case 'commission-rules:archive': {
        const state = actionKey === 'activate' ? 'active' : 'archived';
        result = await db.tx(async (tx) => {
          const current = await tx.query(`SELECT * FROM platform_commission_rules WHERE id = $1 FOR UPDATE`, [recordId]);
          if (!current.rows[0]) throw new NotFoundError('Commission rule');
          if (state === 'active') {
            await tx.query(
              `UPDATE platform_commission_rules
                  SET status = 'archived', effective_to = now(), updated_at = now()
                WHERE product_type = $1 AND status = 'active' AND id <> $2`,
              [current.rows[0].product_type, recordId],
            );
          }
          const updated = await tx.query(
            `UPDATE platform_commission_rules
                SET status = $2,
                    effective_from = CASE WHEN $2 = 'active' THEN now() ELSE effective_from END,
                    effective_to = CASE WHEN $2 = 'archived' THEN now() ELSE NULL END,
                    updated_at = now()
              WHERE id = $1 RETURNING *`,
            [recordId, state],
          );
          return updated.rows[0];
        });
        break;
      }

      /* Payout methods */
      case 'payout-methods:enable':
      case 'payout-methods:disable': {
        const updated = await db.query(
          `UPDATE platform_payout_methods
              SET enabled = $2, updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, actionKey === 'enable'],
        );
        if (!updated.rows[0]) throw new NotFoundError('Payout method');
        result = updated.rows[0];
        break;
      }

      /* Feature flags */
      case 'admin-feature-flags:enable':
      case 'admin-feature-flags:disable': {
        const updated = await db.query(
          `UPDATE admin_feature_flags
              SET enabled = $2, updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, actionKey === 'enable'],
        );
        if (!updated.rows[0]) throw new NotFoundError('Feature flag');
        result = updated.rows[0];
        break;
      }

      /* Operational alerts */
      case 'admin-alert-events:acknowledge':
      case 'admin-alert-events:resolve': {
        const updated = actionKey === 'acknowledge'
          ? await db.query(
              `UPDATE admin_alert_events
                  SET state = 'acknowledged', acknowledged_by = $2, acknowledged_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId, actorId],
            )
          : await db.query(
              `UPDATE admin_alert_events
                  SET state = 'resolved', resolved_at = now()
                WHERE id = $1 RETURNING *`,
              [recordId],
            );
        if (!updated.rows[0]) throw new NotFoundError('Alert event');
        result = updated.rows[0];
        break;
      }

      /* Administrator role assignments */
      case 'admin-assignments:create': {
        const userId = requireString(body, 'userId');
        const roleId = requireString(body, 'roleId');
        const scopeType = assertStatus(
          requireString(body, 'scopeType'),
          ['global', 'workspace'],
          'scopeType',
        );
        const scopeId = scopeType === 'workspace' ? requireString(body, 'scopeId') : null;
        const secondApproverId = requireString(body, 'secondApproverId');
        if (secondApproverId === actorId) {
          throw new ValidationError('A second, different administrator must approve the assignment');
        }

        const [user, role, approver] = await Promise.all([
          db.query(`SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL`, [userId]),
          db.query(`SELECT id FROM admin_role_definitions WHERE id = $1`, [roleId]),
          db.query(
            `SELECT user_id FROM admin_user_role_assignments
              WHERE user_id = $1 AND revoked_at IS NULL LIMIT 1`,
            [secondApproverId],
          ),
        ]);
        if (!user.rows[0]) throw new NotFoundError('User');
        if (!role.rows[0]) throw new NotFoundError('Administrator role');
        if (!approver.rows[0]) throw new ValidationError('Second approver is not an active administrator');

        const inserted = await db.query(
          `INSERT INTO admin_user_role_assignments
             (user_id, role_id, scope_type, scope_id, assigned_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, role_id, scope_type, scope_id)
           DO UPDATE SET revoked_at = NULL, assigned_by = EXCLUDED.assigned_by, assigned_at = now()
           RETURNING *`,
          [userId, roleId, scopeType, scopeId, actorId],
        );
        result = { ...inserted.rows[0], secondApproverId };
        break;
      }

      /* Operation jobs */
      case 'admin-jobs:cancel':
        if (!operationJobService?.cancelJob) throw new ConflictError('Job cancellation is unavailable');
        result = await operationJobService.cancelJob({ jobId: recordId, actorId, reason });
        break;

      /* Sessions */
      case 'user-sessions:revoke': {
        const updated = await db.query(
          `UPDATE user_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING *`,
          [recordId],
        );
        if (!updated.rows[0]) throw new ConflictError('Session is already revoked');
        result = updated.rows[0];
        break;
      }

      /* Risk alerts */
      case 'risk-alerts:acknowledge':
      case 'risk-alerts:resolve': {
        const updated = actionKey === 'acknowledge'
          ? await db.query(
              `UPDATE risk_alerts
                  SET state = 'acknowledged', acknowledged_by = $2, acknowledged_at = now()
                WHERE id = $1 AND state = 'open' RETURNING *`,
              [recordId, actorId],
            )
          : await db.query(
              `UPDATE risk_alerts
                  SET state = 'resolved', resolved_at = now()
                WHERE id = $1 AND state IN ('open', 'acknowledged') RETURNING *`,
              [recordId],
            );
        if (!updated.rows[0]) throw new ConflictError('Risk alert is already in that state');
        result = updated.rows[0];
        break;
      }

      /* Risk emergency controls */
      case 'risk-emergency-pauses:engage': {
        const scopeType = assertStatus(
          requireString(body, 'scopeType'),
          ['platform_wide', 'workspace', 'exchange_adapter', 'destination_account', 'instrument', 'sync_group'],
          'scopeType',
        );
        const scopeId = scopeType === 'platform_wide' ? null : requireString(body, 'scopeId');
        if (scopeId && !isUuid(scopeId)) throw new ValidationError('scopeId must be a UUID');
        const highImpact = ['platform_wide', 'workspace', 'exchange_adapter'].includes(scopeType);
        const secondApproverId = String(body?.secondApproverId || '').trim();
        if (highImpact) {
          if (!secondApproverId) {
            throw new ValidationError('A second administrator is required for this emergency pause');
          }
          if (!isUuid(secondApproverId)) throw new ValidationError('secondApproverId must be a UUID');
          if (secondApproverId === actorId) {
            throw new ValidationError('A second, different administrator must approve this emergency pause');
          }
        }

        result = await db.tx(async (tx) => {
          if (highImpact) {
            const approver = await tx.query(
              `SELECT user_id FROM admin_user_role_assignments
                WHERE user_id = $1 AND revoked_at IS NULL LIMIT 1`,
              [secondApproverId],
            );
            if (!approver.rows[0]) {
              throw new ValidationError('Second approver is not an active administrator');
            }
          }

          let workspaceId = scopeType === 'workspace' ? scopeId : null;
          if (scopeType === 'exchange_adapter') {
            const connection = await tx.query(
              `SELECT workspace_id FROM exchange_connections WHERE id = $1`,
              [scopeId],
            );
            if (!connection.rows[0]) throw new NotFoundError('Exchange connection');
            workspaceId = connection.rows[0].workspace_id;
          } else if (scopeType === 'destination_account') {
            const account = await tx.query(
              `SELECT c.workspace_id FROM exchange_accounts a
                 JOIN exchange_connections c ON c.id = a.connection_id
                WHERE a.id = $1`,
              [scopeId],
            );
            if (!account.rows[0]) throw new NotFoundError('Exchange account');
            workspaceId = account.rows[0].workspace_id;
          } else if (scopeType === 'sync_group') {
            const group = await tx.query(`SELECT workspace_id FROM sync_groups WHERE id = $1`, [scopeId]);
            if (!group.rows[0]) throw new NotFoundError('Synchronization group');
            workspaceId = group.rows[0].workspace_id;
          } else if (scopeType === 'instrument') {
            const instrument = await tx.query(`SELECT id FROM exchange_instruments WHERE id = $1`, [scopeId]);
            if (!instrument.rows[0]) throw new NotFoundError('Instrument');
          } else if (scopeType === 'workspace') {
            const workspace = await tx.query(`SELECT id FROM workspaces WHERE id = $1`, [scopeId]);
            if (!workspace.rows[0]) throw new NotFoundError('Workspace');
          }

          const existing = await tx.query(
            `SELECT id FROM risk_emergency_pause_events
              WHERE scope_type = $1
                AND COALESCE(scope_id::text, '') = COALESCE($2::text, '')
                AND status IN ('requested', 'propagating', 'active')
              LIMIT 1`,
            [scopeType, scopeId],
          );
          if (existing.rows[0]) {
            throw new ConflictError('An active emergency pause already exists for this scope', 'PAUSE_ALREADY_ACTIVE');
          }

          const pause = await tx.query(
            `INSERT INTO risk_emergency_pause_events
               (workspace_id, scope_type, scope_id, status, reason, initiated_by)
             VALUES ($1, $2, $3, 'active', $4, $5)
             RETURNING *`,
            [workspaceId, scopeType, scopeId, reason, actorId],
          );

          const reference = `INC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 6).toUpperCase()}`;
          const incident = await tx.query(
            `INSERT INTO platform_incidents
               (reference, title, severity, status, summary, affected_services, incident_owner_id)
             VALUES ($1, $2, $3, 'investigating', $4, $5, $6)
             RETURNING *`,
            [
              reference,
              `Emergency pause engaged: ${scopeType.replaceAll('_', ' ')}`,
              highImpact ? 'sev1' : 'sev2',
              `Emergency pause ${pause.rows[0].id} engaged for ${scopeType}${scopeId ? ` (${scopeId})` : ''}. Reason: ${reason}`,
              ['trading', 'order-submission'],
              actorId,
            ],
          );
          await tx.query(
            `INSERT INTO platform_incident_events (incident_id, event_type, actor_id, message, metadata)
             VALUES ($1, 'emergency_pause_engaged', $2, $3, $4::jsonb)`,
            [
              incident.rows[0].id,
              actorId,
              `Pause engaged for ${scopeType}`,
              JSON.stringify({ pauseId: pause.rows[0].id, scopeType, scopeId, secondApproverId: secondApproverId || null }),
            ],
          );

          const outcome = {
            ...pause.rows[0],
            incidentId: incident.rows[0].id,
            incidentReference: incident.rows[0].reference,
            secondApproverId: secondApproverId || null,
          };
          if (events?.publish) {
            await events.publish(
              tx,
              'risk.emergency_pause_active',
              {
                pauseId: outcome.id,
                scope: scopeType,
                scopeRef: scopeId,
                reason,
                incidentId: outcome.incidentId,
                actorId,
              },
              {
                actorId,
                workspaceId: outcome.workspace_id,
                resourceType: 'emergency_pause',
                resourceId: outcome.id,
              },
            );
          }
          return outcome;
        });
        break;
      }
      case 'risk-emergency-pauses:resume': {
        const pause = await db.query(
          `SELECT * FROM risk_emergency_pause_events WHERE id = $1`,
          [recordId],
        );
        if (!pause.rows[0]) throw new NotFoundError('Emergency pause');
        if (pause.rows[0].status === 'resumed') {
          throw new ConflictError('Emergency pause is already resumed', 'ALREADY_RESUMED');
        }
        const updated = await db.tx(async (tx) => {
          const resumed = await tx.query(
            `UPDATE risk_emergency_pause_events
                SET status = 'resumed', resumed_at = now()
              WHERE id = $1 AND status IN ('requested', 'propagating', 'active')
              RETURNING *`,
            [recordId],
          );
          if (!resumed.rows[0]) {
            throw new ConflictError('Emergency pause is already resumed', 'ALREADY_RESUMED');
          }
          if (events?.publish) {
            await events.publish(
              tx,
              'risk.emergency_pause_resumed',
              {
                pauseId: recordId,
                scope: pause.rows[0].scope_type,
                scopeRef: pause.rows[0].scope_id,
                reason,
                actorId,
              },
              {
                actorId,
                workspaceId: pause.rows[0].workspace_id,
                resourceType: 'emergency_pause',
                resourceId: recordId,
              },
            );
          }
          return resumed.rows[0];
        });
        result = updated;
        break;
      }

      /* Featured placement */
      case 'marketplace-providers:set_featured':
      case 'marketplace-signals:set_featured':
      case 'marketplace-strategies:set_featured': {
        const table = {
          'marketplace-providers': 'marketplace_provider_profiles',
          'marketplace-signals': 'marketplace_published_signals',
          'marketplace-strategies': 'marketplace_strategies',
        }[resourceKey];
        const featured = body?.featured === true || body?.featured === 'true';
        const rank = resourceKey === 'marketplace-providers' && featured && body?.rank != null
          ? Math.max(0, Math.trunc(Number(body.rank)))
          : null;
        if (rank != null && !Number.isFinite(rank)) throw new ValidationError('rank must be a number');
        const columns = resourceKey === 'marketplace-providers'
          ? 'is_featured = $2, featured_rank = $3'
          : 'is_featured = $2';
        const values = resourceKey === 'marketplace-providers'
          ? [recordId, featured, rank]
          : [recordId, featured];
        const updated = await db.query(
          `UPDATE ${table} SET ${columns} WHERE id = $1 RETURNING *`,
          values,
        );
        if (!updated.rows[0]) throw new NotFoundError('Featured record');
        result = updated.rows[0];
        break;
      }

      /* Community pinned posts */
      case 'community-posts:pin':
      case 'community-posts:unpin': {
        const pinned = actionKey === 'pin';
        const updated = await db.query(
          `UPDATE community_posts
              SET is_pinned = $2,
                  pinned_at = CASE WHEN $2 THEN now() ELSE NULL END,
                  updated_at = now()
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING *`,
          [recordId, pinned],
        );
        if (!updated.rows[0]) throw new NotFoundError('Community post');
        result = updated.rows[0];
        break;
      }

      /* Support tickets */
      case 'support-tickets:assign': {
        const assignee = requireString(body, 'userId');
        const updated = await db.query(
          `UPDATE support_tickets
              SET assigned_to_id = $2,
                  status = CASE WHEN status IN ('new', 'open') THEN 'assigned' ELSE status END,
                  updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, assignee],
        );
        if (!updated.rows[0]) throw new NotFoundError('Support ticket');
        result = updated.rows[0];
        break;
      }
      case 'support-tickets:set_status': {
        const next = assertStatus(
          requireString(body, 'status'),
          ['open', 'in_progress', 'waiting_for_customer', 'waiting_for_internal_team', 'escalated', 'resolved', 'closed'],
        );
        const updated = await db.query(
          `UPDATE support_tickets
              SET status = $2, updated_at = now(),
                  resolved_at = CASE WHEN $2 IN ('resolved', 'closed') THEN now() ELSE resolved_at END,
                  closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE closed_at END
            WHERE id = $1 RETURNING *`,
          [recordId, next],
        );
        if (!updated.rows[0]) throw new NotFoundError('Support ticket');
        result = updated.rows[0];
        break;
      }

      /* Knowledge base */
      case 'support-articles:publish':
      case 'support-articles:archive': {
        const state = actionKey === 'publish' ? 'published' : 'archived';
        const updated = await db.query(
          `UPDATE support_articles
              SET state = $2,
                  published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
                  archived_at = CASE WHEN $2 = 'archived' THEN now() ELSE NULL END,
                  updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, state],
        );
        if (!updated.rows[0]) throw new NotFoundError('Support article');
        result = updated.rows[0];
        break;
      }

      /* Community content */
      case 'community-posts:remove':
      case 'community-comments:remove': {
        const table = resourceKey === 'community-posts' ? 'community_posts' : 'community_comments';
        const updated = await db.query(
          `UPDATE ${table} SET deleted_at = now(), updated_at = now()
            WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
          [recordId],
        );
        if (!updated.rows[0]) throw new ConflictError('Content is already removed');
        result = updated.rows[0];
        break;
      }
      case 'community-moderation:resolve':
      case 'community-moderation:dismiss': {
        const state = actionKey === 'resolve' ? 'resolved' : 'dismissed';
        const updated = await db.query(
          `UPDATE community_moderation_cases
              SET state = $2, resolved_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, state],
        );
        if (!updated.rows[0]) throw new NotFoundError('Moderation case');
        result = updated.rows[0];
        break;
      }

      /* Developer applications */
      case 'developer-applications:suspend':
      case 'developer-applications:activate': {
        const state = actionKey === 'suspend' ? 'suspended' : 'active';
        const updated = await db.query(
          `UPDATE developer_applications SET state = $2, updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, state],
        );
        if (!updated.rows[0]) throw new NotFoundError('Developer application');
        result = updated.rows[0];
        break;
      }
      case 'developer-webhooks:suspend':
      case 'developer-webhooks:resume': {
        const state = actionKey === 'suspend' ? 'suspended' : 'active';
        const updated = await db.query(
          `UPDATE developer_webhook_subscriptions SET state = $2, updated_at = now()
            WHERE id = $1 RETURNING *`,
          [recordId, state],
        );
        if (!updated.rows[0]) throw new NotFoundError('Webhook subscription');
        result = updated.rows[0];
        break;
      }

      default:
        throw new AppError('This action is not implemented', { status: 409, code: 'ACTION_NOT_IMPLEMENTED' });
    }

    if (!result) throw new ConflictError('The action could not be completed');

    await audit.write({
      actorId,
      action: `admin_console.${resourceKey}.${actionKey}`,
      targetResource: resource.key,
      targetId: recordId || result.id || null,
      reason,
      after: typeof result === 'object' ? { id: result.id, status: result.status || result.state || null } : null,
      ipAddress,
      userAgent,
    });

    logger.info({ actorId, resourceKey, actionKey, recordId }, 'Admin console action completed');

    if (events?.publish) {
      await db.tx((tx) => events.publish(tx, 'admin.console_action', {
        resourceKey,
        actionKey,
        recordId: recordId || result.id || null,
        actorId,
      }));
    }

    return result;
  }

  async function addNote({ resourceKey, recordId, note, actorId }) {
    const resource = getResource(resourceKey);
    if (!resource) throw new NotFoundError('Admin resource');
    const text = String(note || '').trim();
    if (text.length < 3) throw new ValidationError('Note is required');
    const result = await db.query(
      `INSERT INTO admin_internal_notes (resource_type, resource_id, note, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [resource.key, recordId, text, actorId],
    );
    await audit.write({
      actorId,
      action: 'admin_console.note.created',
      targetResource: resource.key,
      targetId: recordId,
      reason: text.slice(0, 500),
    });
    return result.rows[0];
  }

  return { perform, addNote };
}

export default createConsoleActionService;
