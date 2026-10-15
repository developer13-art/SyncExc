/**
 * SyncExc Server — Referral queries
 */

export function createReferralQueries({ db }) {
  return {
    /* =========================================================================
     * AFFILIATES
     * ====================================================================== */

    async insertAffiliate(client, data) {
      const result = await client.query(
        `
        INSERT INTO affiliates (user_id, status, payout_currency, enrolled_at)
        VALUES ($1, 'active', $2, now())
        ON CONFLICT (user_id) DO NOTHING
        RETURNING *
        `,
        [data.userId, data.payoutCurrency || 'USD']
      );
      return result.rows[0] || null;
    },

    async findAffiliateByUserId(userId) {
      const result = await db.query(
        `SELECT * FROM affiliates WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    },

    async findAffiliateById(affiliateId) {
      const result = await db.query(
        `SELECT * FROM affiliates WHERE id = $1`,
        [affiliateId]
      );
      return result.rows[0] || null;
    },

    async updateAffiliateStatus(affiliateId, status) {
      const result = await db.query(
        `
        UPDATE affiliates SET status = $2, updated_at = now() WHERE id = $1 RETURNING *
        `,
        [affiliateId, status]
      );
      return result.rows[0] || null;
    },

    async insertAgreement(client, data) {
      const result = await client.query(
        `
        INSERT INTO affiliate_agreements (affiliate_id, version, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (affiliate_id, version) DO NOTHING
        RETURNING *
        `,
        [data.affiliateId, data.version, data.ipAddress || null, data.userAgent || null]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * LINKS
     * ====================================================================== */

    async insertLink(client, data) {
      const result = await client.query(
        `
        INSERT INTO affiliate_referral_links (affiliate_id, code, name, campaign_label, tracking_params)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.affiliateId,
          data.code,
          data.name,
          data.campaignLabel || null,
          data.trackingParams ? JSON.stringify(data.trackingParams) : null,
        ]
      );
      return result.rows[0];
    },

    async findLinkByCode(code) {
      const result = await db.query(
        `SELECT * FROM affiliate_referral_links WHERE code = $1`,
        [code]
      );
      return result.rows[0] || null;
    },

    async findLinkById(linkId) {
      const result = await db.query(
        `SELECT * FROM affiliate_referral_links WHERE id = $1`,
        [linkId]
      );
      return result.rows[0] || null;
    },

    async listLinksForAffiliate(affiliateId) {
      const result = await db.query(
        `
        SELECT * FROM affiliate_referral_links
        WHERE affiliate_id = $1
        ORDER BY created_at DESC
        `,
        [affiliateId]
      );
      return result.rows;
    },

    async updateLinkStatus(linkId, status) {
      const result = await db.query(
        `
        UPDATE affiliate_referral_links
        SET status = $2,
            paused_at = CASE WHEN $2 = 'paused' THEN now() ELSE paused_at END,
            revoked_at = CASE WHEN $2 = 'revoked' THEN now() ELSE revoked_at END,
            expired_at = CASE WHEN $2 = 'expired' THEN now() ELSE expired_at END
        WHERE id = $1
        RETURNING *
        `,
        [linkId, status]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * CLICKS
     * ====================================================================== */

    async insertClick(client, data) {
      const result = await client.query(
        `
        INSERT INTO referral_click_events (link_id, affiliate_id, session_ref, ip_address, user_agent, referrer)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.linkId,
          data.affiliateId,
          data.sessionRef || null,
          data.ipAddress || null,
          data.userAgent || null,
          data.referrer || null,
        ]
      );
      return result.rows[0];
    },

    async countClicksForLink(linkId, { since } = {}) {
      const params = [linkId];
      let sinceClause = '';
      if (since) {
        params.push(since);
        sinceClause = `AND occurred_at >= $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT count(*)::int AS count FROM referral_click_events
        WHERE link_id = $1 ${sinceClause}
        `,
        params
      );
      return result.rows[0].count;
    },

    /* =========================================================================
     * ATTRIBUTIONS
     * ====================================================================== */

    async insertAttribution(client, data) {
      const result = await client.query(
        `
        INSERT INTO referral_attributions (
          affiliate_id, link_id, referred_user_id, state, policy_version,
          click_event_id, first_attributed_at
        )
        VALUES ($1, $2, $3, 'attributed', $4, $5, now())
        ON CONFLICT (referred_user_id) WHERE state = 'attributed' DO NOTHING
        RETURNING *
        `,
        [
          data.affiliateId,
          data.linkId || null,
          data.referredUserId,
          data.policyVersion,
          data.clickEventId || null,
        ]
      );
      return result.rows[0] || null;
    },

    async findAttributionByReferredUser(referredUserId) {
      const result = await db.query(
        `
        SELECT * FROM referral_attributions
        WHERE referred_user_id = $1 AND state IN ('attributed', 'converted')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [referredUserId]
      );
      return result.rows[0] || null;
    },

    async findAttributionById(attributionId) {
      const result = await db.query(
        `SELECT * FROM referral_attributions WHERE id = $1`,
        [attributionId]
      );
      return result.rows[0] || null;
    },

    async updateAttributionState(attributionId, state, extra = {}) {
      const result = await db.query(
        `
        UPDATE referral_attributions
        SET state = $2,
            converted_at = COALESCE($3, converted_at),
            revoked_at = COALESCE($4, revoked_at)
        WHERE id = $1
        RETURNING *
        `,
        [attributionId, state, extra.convertedAt || null, extra.revokedAt || null]
      );
      return result.rows[0] || null;
    },

    async listAttributionsForAffiliate(affiliateId, { limit = 50, cursor = null } = {}) {
      const params = [affiliateId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND created_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM referral_attributions
        WHERE affiliate_id = $1 ${cursorClause}
        ORDER BY created_at DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.created_at.toISOString() : null,
      };
    },

    async insertAttributionEvent(client, data) {
      await client.query(
        `
        INSERT INTO referral_attribution_events (attribution_id, event_type, actor_id, reason, metadata)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          data.attributionId,
          data.eventType,
          data.actorId || null,
          data.reason || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
    },

    /* =========================================================================
     * COMMISSION POLICIES
     * ====================================================================== */

    async insertPolicy(client, data) {
      const result = await client.query(
        `
        INSERT INTO commission_policies (name, status, created_by)
        VALUES ($1, 'draft', $2)
        RETURNING *
        `,
        [data.name, data.createdBy || null]
      );
      return result.rows[0];
    },

    async insertPolicyVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO commission_policy_versions (
          policy_id, version, config, effective_from, effective_until
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (policy_id, version) DO NOTHING
        RETURNING *
        `,
        [
          data.policyId,
          data.version,
          JSON.stringify(data.config),
          data.effectiveFrom,
          data.effectiveUntil || null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertEligibilityRule(client, data) {
      const result = await client.query(
        `
        INSERT INTO commission_eligibility_rules (policy_version_id, rule_type, config)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.policyVersionId, data.ruleType, JSON.stringify(data.config)]
      );
      return result.rows[0];
    },

    async findPolicyById(policyId) {
      const result = await db.query(
        `SELECT * FROM commission_policies WHERE id = $1`,
        [policyId]
      );
      return result.rows[0] || null;
    },

    async findActivePolicyVersion(policyId) {
      const result = await db.query(
        `
        SELECT * FROM commission_policy_versions
        WHERE policy_id = $1
          AND effective_from <= now()
          AND (effective_until IS NULL OR effective_until > now())
        ORDER BY version DESC
        LIMIT 1
        `,
        [policyId]
      );
      return result.rows[0] || null;
    },

    async findLatestPolicyVersion(policyId) {
      const result = await db.query(
        `
        SELECT * FROM commission_policy_versions
        WHERE policy_id = $1
        ORDER BY version DESC
        LIMIT 1
        `,
        [policyId]
      );
      return result.rows[0] || null;
    },

    async listPolicies({ status } = {}) {
      const params = [];
      let statusClause = '';
      if (status) {
        params.push(status);
        statusClause = `WHERE status = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM commission_policies ${statusClause}
        ORDER BY created_at DESC
        `,
        params
      );
      return result.rows;
    },

    async listEligibilityRules(policyVersionId) {
      const result = await db.query(
        `SELECT * FROM commission_eligibility_rules WHERE policy_version_id = $1`,
        [policyVersionId]
      );
      return result.rows;
    },

    async updatePolicyStatus(policyId, status) {
      const result = await db.query(
        `UPDATE commission_policies SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [policyId, status]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * COMMISSION ACCRUALS
     * ====================================================================== */

    async insertAccrual(client, data) {
      const result = await client.query(
        `
        INSERT INTO commission_accruals (
          affiliate_id, attribution_id, payment_id, policy_version_id,
          type, state, amount_minor, currency, hold_until
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (payment_id, type) DO NOTHING
        RETURNING *
        `,
        [
          data.affiliateId,
          data.attributionId,
          data.paymentId,
          data.policyVersionId,
          data.type,
          data.state || 'accumulated',
          data.amountMinor,
          data.currency,
          data.holdUntil || null,
        ]
      );
      return result.rows[0] || null;
    },

    async findAccrualByPayment(paymentId, type) {
      const result = await db.query(
        `SELECT * FROM commission_accruals WHERE payment_id = $1 AND type = $2`,
        [paymentId, type]
      );
      return result.rows[0] || null;
    },

    async listAccrualsForAffiliate(affiliateId, { limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM commission_accruals
        WHERE affiliate_id = $1
        ORDER BY accrued_at DESC
        LIMIT $2
        `,
        [affiliateId, limit]
      );
      return result.rows;
    },

    async updateAccrualState(accrualId, state) {
      const result = await db.query(
        `UPDATE commission_accruals SET state = $2 WHERE id = $1 RETURNING *`,
        [accrualId, state]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * LEDGER
     * ====================================================================== */

    async insertLedgerEntry(client, data) {
      const result = await client.query(
        `
        INSERT INTO commission_ledger_entries (
          affiliate_id, accrual_id, entry_type, amount_minor, currency,
          source_type, source_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.affiliateId,
          data.accrualId || null,
          data.entryType,
          data.amountMinor,
          data.currency,
          data.sourceType || null,
          data.sourceId || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async listLedgerEntries(affiliateId, { limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM commission_ledger_entries
        WHERE affiliate_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [affiliateId, limit]
      );
      return result.rows;
    },

    async sumLedgerByType(affiliateId, currency) {
      const result = await db.query(
        `
        SELECT entry_type, COALESCE(sum(amount_minor), 0)::text AS total
        FROM commission_ledger_entries
        WHERE affiliate_id = $1 AND currency = $2
        GROUP BY entry_type
        `,
        [affiliateId, currency]
      );
      return result.rows.reduce((acc, r) => {
        acc[r.entry_type] = r.total;
        return acc;
      }, {});
    },

    /* =========================================================================
     * PAYOUT METHODS
     * ====================================================================== */

    async insertPayoutMethod(client, data) {
      const result = await client.query(
        `
        INSERT INTO affiliate_payout_methods (
          affiliate_id, provider, provider_token, display_summary, status
        )
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING *
        `,
        [
          data.affiliateId,
          data.provider,
          data.providerToken,
          data.displaySummary ? JSON.stringify(data.displaySummary) : null,
        ]
      );
      return result.rows[0];
    },

    async listPayoutMethods(affiliateId) {
      const result = await db.query(
        `
        SELECT * FROM affiliate_payout_methods
        WHERE affiliate_id = $1 AND status = 'active'
        `,
        [affiliateId]
      );
      return result.rows;
    },

    async findPayoutMethodById(id) {
      const result = await db.query(
        `SELECT * FROM affiliate_payout_methods WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * PAYOUTS
     * ====================================================================== */

    async insertPayoutRequest(client, data) {
      const result = await client.query(
        `
        INSERT INTO affiliate_payout_requests (
          affiliate_id, method_id, amount_minor, currency, status, reservation_ref
        )
        VALUES ($1, $2, $3, $4, 'requested', $5)
        RETURNING *
        `,
        [
          data.affiliateId,
          data.methodId,
          data.amountMinor,
          data.currency,
          data.reservationRef || null,
        ]
      );
      return result.rows[0];
    },

    async findPayoutRequestById(id) {
      const result = await db.query(
        `SELECT * FROM affiliate_payout_requests WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async updatePayoutRequest(id, fields) {
      const result = await db.query(
        `
        UPDATE affiliate_payout_requests
        SET status = COALESCE($2, status),
            provider_reference = COALESCE($3, provider_reference),
            failure_reason = COALESCE($4, failure_reason),
            approved_at = COALESCE($5, approved_at),
            processing_at = COALESCE($6, processing_at),
            completed_at = COALESCE($7, completed_at)
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          fields.status ?? null,
          fields.providerReference ?? null,
          fields.failureReason ?? null,
          fields.approvedAt ?? null,
          fields.processingAt ?? null,
          fields.completedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async listPayoutsForAffiliate(affiliateId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM affiliate_payout_requests
        WHERE affiliate_id = $1
        ORDER BY requested_at DESC
        LIMIT $2
        `,
        [affiliateId, limit]
      );
      return result.rows;
    },

    async insertPayoutEvent(client, data) {
      await client.query(
        `
        INSERT INTO affiliate_payout_events (payout_id, event_type, actor_id, metadata)
        VALUES ($1, $2, $3, $4)
        `,
        [
          data.payoutId,
          data.eventType,
          data.actorId || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
    },

    async insertPayoutProviderTransaction(client, data) {
      const result = await client.query(
        `
        INSERT INTO affiliate_payout_provider_transactions (
          payout_id, provider, provider_tx_id, status, raw_response
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.payoutId,
          data.provider,
          data.providerTxId || null,
          data.status,
          data.rawResponse ? JSON.stringify(data.rawResponse) : null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * FRAUD CASES
     * ====================================================================== */

    async insertFraudCase(client, data) {
      const result = await client.query(
        `
        INSERT INTO affiliate_fraud_cases (affiliate_id, state, severity, evidence)
        VALUES ($1, 'detected', $2, $3)
        RETURNING *
        `,
        [
          data.affiliateId,
          data.severity,
          data.evidence ? JSON.stringify(data.evidence) : null,
        ]
      );
      return result.rows[0];
    },

    async updateFraudCaseState(caseId, state) {
      const result = await db.query(
        `
        UPDATE affiliate_fraud_cases
        SET state = $2, closed_at = CASE WHEN $2 IN ('cleared', 'confirmed_abuse', 'closed') THEN now() ELSE closed_at END
        WHERE id = $1
        RETURNING *
        `,
        [caseId, state]
      );
      return result.rows[0] || null;
    },

    async listFraudCases({ state, limit = 50 } = {}) {
      const params = [limit];
      let stateClause = '';
      if (state) {
        params.push(state);
        stateClause = `WHERE state = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM affiliate_fraud_cases ${stateClause}
        ORDER BY opened_at DESC
        LIMIT $1
        `,
        params
      );
      return result.rows;
    },

    /* =========================================================================
     * WALLET / SNAPSHOT
     * ====================================================================== */

    async upsertWallet(client, data) {
      const result = await client.query(
        `
        INSERT INTO referral_wallet (affiliate_id, currency, available_minor, pending_minor, held_minor, paid_minor)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (affiliate_id, currency) DO UPDATE SET
          available_minor = EXCLUDED.available_minor,
          pending_minor = EXCLUDED.pending_minor,
          held_minor = EXCLUDED.held_minor,
          paid_minor = EXCLUDED.paid_minor,
          updated_at = now()
        RETURNING *
        `,
        [
          data.affiliateId,
          data.currency,
          data.availableMinor || 0,
          data.pendingMinor || 0,
          data.heldMinor || 0,
          data.paidMinor || 0,
        ]
      );
      return result.rows[0];
    },

    async getWallet(affiliateId, currency) {
      const result = await db.query(
        `SELECT * FROM referral_wallet WHERE affiliate_id = $1 AND currency = $2`,
        [affiliateId, currency]
      );
      return result.rows[0] || null;
    },

    async insertBalanceSnapshot(client, data) {
      await client.query(
        `
        INSERT INTO affiliate_balance_snapshots (
          affiliate_id, currency, pending_minor, held_minor, payable_minor, paid_minor
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          data.affiliateId,
          data.currency,
          data.pendingMinor || 0,
          data.heldMinor || 0,
          data.payableMinor || 0,
          data.paidMinor || 0,
        ]
      );
    },

    /* =========================================================================
     * AUDIT
     * ====================================================================== */

    async insertAuditEvent(client, data) {
      await client.query(
        `
        INSERT INTO referral_audit_events (
          actor_id, affiliate_id, action, resource_type, resource_id, before, after, outcome
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          data.actorId || null,
          data.affiliateId || null,
          data.action,
          data.resourceType,
          data.resourceId,
          data.before ? JSON.stringify(data.before) : null,
          data.after ? JSON.stringify(data.after) : null,
          data.outcome || 'success',
        ]
      );
    },
  };
}

export default createReferralQueries;