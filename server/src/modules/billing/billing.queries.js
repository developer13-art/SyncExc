/**
 * SyncExc Server — Billing queries
 */

export function createBillingQueries({ db }) {
  return {
    /* =========================================================================
     * PLANS
     * ====================================================================== */

    async listPlans({ status = 'active' } = {}) {
      const result = await db.query(
        `
        SELECT p.*, 
          (SELECT row_to_json(v) FROM (
            SELECT * FROM subscription_plan_versions 
            WHERE plan_id = p.id ORDER BY version_number DESC LIMIT 1
          ) v) AS latest_version
        FROM subscription_plans p
        WHERE p.status = $1
        ORDER BY p.created_at ASC
        `,
        [status]
      );
      return result.rows;
    },

    async findPlanById(planId) {
      const result = await db.query(
        `SELECT * FROM subscription_plans WHERE id = $1`,
        [planId]
      );
      return result.rows[0] || null;
    },

    async findPlanVersion(planVersionId) {
      const result = await db.query(
        `SELECT * FROM subscription_plan_versions WHERE id = $1`,
        [planVersionId]
      );
      return result.rows[0] || null;
    },

    async findLatestPlanVersion(planId) {
      const result = await db.query(
        `
        SELECT * FROM subscription_plan_versions
        WHERE plan_id = $1
        ORDER BY version_number DESC
        LIMIT 1
        `,
        [planId]
      );
      return result.rows[0] || null;
    },

    async listPlanPrices(planVersionId) {
      const result = await db.query(
        `
        SELECT * FROM subscription_plan_prices
        WHERE plan_version_id = $1
          AND (effective_until IS NULL OR effective_until > now())
        ORDER BY billing_interval ASC, currency ASC
        `,
        [planVersionId]
      );
      return result.rows;
    },

    async findPlanPriceById(priceId) {
      const result = await db.query(
        `SELECT * FROM subscription_plan_prices WHERE id = $1`,
        [priceId]
      );
      return result.rows[0] || null;
    },

    async findCheckoutCustomerEmail(scopeType, scopeId) {
      const result = await db.query(
        `SELECT u.email
         FROM users u
         WHERE u.id = CASE
           WHEN $1 = 'user' THEN $2::uuid
           ELSE (SELECT owner_id FROM workspaces WHERE id = $2::uuid)
         END
           AND u.deleted_at IS NULL`,
        [scopeType, scopeId]
      );
      return result.rows[0]?.email ?? null;
    },

    /* =========================================================================
     * CHECKOUT
     * ====================================================================== */

    async insertCheckoutSession(client, data) {
      const result = await client.query(
        `
        INSERT INTO checkout_sessions (
          billing_scope_type, billing_scope_id, plan_price_id, provider,
          amount_minor, currency, success_url, cancel_url, expires_at, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          data.scopeType,
          data.scopeId,
          data.planPriceId,
          data.provider,
          data.amountMinor,
          data.currency,
          data.successUrl,
          data.cancelUrl,
          data.expiresAt,
          JSON.stringify(data.metadata || {}),
        ]
      );
      return result.rows[0];
    },

    async updateCheckoutSession(id, fields) {
      const result = await db.query(
        `
        UPDATE checkout_sessions
        SET provider_checkout_reference = COALESCE($2, provider_checkout_reference),
            status = COALESCE($3, status),
            completed_at = COALESCE($4, completed_at),
            metadata = CASE
              WHEN $5::jsonb IS NULL THEN metadata
              ELSE COALESCE(metadata, '{}'::jsonb) || $5::jsonb
            END
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          fields.providerCheckoutReference || null,
          fields.status || null,
          fields.completedAt || null,
          fields.metadata ? JSON.stringify(fields.metadata) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async findCheckoutSessionForScope(id, scopeType, scopeId) {
      const result = await db.query(
        `
        SELECT cs.*, p.name AS plan_name, pp.billing_interval
        FROM checkout_sessions cs
        JOIN subscription_plan_prices pp ON pp.id = cs.plan_price_id
        JOIN subscription_plan_versions pv ON pv.id = pp.plan_version_id
        JOIN subscription_plans p ON p.id = pv.plan_id
        WHERE cs.id = $1
          AND cs.billing_scope_type = $2
          AND cs.billing_scope_id = $3
        `,
        [id, scopeType, scopeId]
      );
      return result.rows[0] || null;
    },

    async findCheckoutSessionById(id) {
      const result = await db.query(
        `SELECT * FROM checkout_sessions WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * SUBSCRIPTIONS
     * ====================================================================== */

    async insertSubscription(client, data) {
      const result = await client.query(
        `
        INSERT INTO subscriptions (
          billing_scope_type, billing_scope_id, plan_version_id, plan_price_id,
          status, current_period_start, current_period_end, next_billing_at,
          provider_subscription_reference
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data.scopeType,
          data.scopeId,
          data.planVersionId,
          data.planPriceId,
          data.status || 'active',
          data.currentPeriodStart,
          data.currentPeriodEnd,
          data.nextBillingAt,
          data.providerSubscriptionReference || null,
        ]
      );
      return result.rows[0];
    },

    async findActiveSubscriptionForScope(scopeType, scopeId) {
      const result = await db.query(
        `
        SELECT s.*, p.id AS plan_id, p.name AS plan_name,
          pp.amount_minor, pp.currency, pp.billing_interval
        FROM subscriptions s
        JOIN subscription_plan_versions pv ON pv.id = s.plan_version_id
        JOIN subscription_plans p ON p.id = pv.plan_id
        JOIN subscription_plan_prices pp ON pp.id = s.plan_price_id
        WHERE s.billing_scope_type = $1 AND s.billing_scope_id = $2
          AND s.status IN ('active', 'trialing', 'past_due', 'grace_period', 'cancel_scheduled')
        ORDER BY s.created_at DESC
        LIMIT 1
        `,
        [scopeType, scopeId]
      );
      return result.rows[0] || null;
    },

    async findSubscriptionById(id) {
      const result = await db.query(
        `SELECT * FROM subscriptions WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listSubscriptionsForScope(scopeType, scopeId) {
      const result = await db.query(
        `
        SELECT * FROM subscriptions
        WHERE billing_scope_type = $1 AND billing_scope_id = $2
        ORDER BY created_at DESC
        `,
        [scopeType, scopeId]
      );
      return result.rows;
    },

    async listSubscriptionsDueForRenewal({ before }) {
      const result = await db.query(
        `
        SELECT * FROM subscriptions
        WHERE status IN ('active', 'past_due', 'grace_period')
          AND next_billing_at IS NOT NULL
          AND next_billing_at <= $1
        ORDER BY next_billing_at ASC
        LIMIT 200
        `,
        [before]
      );
      return result.rows;
    },

    async updateSubscription(id, fields) {
      const result = await db.query(
        `
        UPDATE subscriptions
        SET status = COALESCE($2, status),
            current_period_start = COALESCE($3, current_period_start),
            current_period_end = COALESCE($4, current_period_end),
            next_billing_at = COALESCE($5, next_billing_at),
            cancel_at_period_end = COALESCE($6, cancel_at_period_end),
            canceled_at = CASE WHEN $9 THEN NULL ELSE COALESCE($7, canceled_at) END,
            ended_at = COALESCE($8, ended_at),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          fields.status ?? null,
          fields.currentPeriodStart ?? null,
          fields.currentPeriodEnd ?? null,
          fields.nextBillingAt ?? null,
          fields.cancelAtPeriodEnd ?? null,
          fields.canceledAt ?? null,
          fields.endedAt ?? null,
          fields.clearCanceledAt === true,
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * PAYMENTS
     * ====================================================================== */

    async insertPayment(client, data) {
      const result = await client.query(
        `
        INSERT INTO subscription_payments (
          subscription_id, checkout_session_id, provider,
          provider_payment_reference, amount_minor, currency, status, paid_at, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data.subscriptionId || null,
          data.checkoutSessionId || null,
          data.provider,
          data.providerPaymentReference || null,
          data.amountMinor,
          data.currency,
          data.status,
          data.paidAt || null,
          JSON.stringify(data.metadata || {}),
        ]
      );
      return result.rows[0];
    },

    async findPaymentByProviderReference(provider, reference) {
      const result = await db.query(
        `
        SELECT * FROM subscription_payments
        WHERE provider = $1 AND provider_payment_reference = $2
        LIMIT 1
        `,
        [provider, reference]
      );
      return result.rows[0] || null;
    },

    async listPaymentsForScope(scopeType, scopeId, { limit = 50, cursor = null } = {}) {
      const params = [scopeType, scopeId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND p.created_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT p.* FROM subscription_payments p
        JOIN subscriptions s ON s.id = p.subscription_id
        WHERE s.billing_scope_type = $1 AND s.billing_scope_id = $2
          ${cursorClause}
        ORDER BY p.created_at DESC
        LIMIT $3
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

    /* =========================================================================
     * INVOICES
     * ====================================================================== */

    async insertInvoice(client, data) {
      const result = await client.query(
        `
        INSERT INTO billing_invoices (
          number, subscription_id, billing_scope_type, billing_scope_id,
          status, amount_minor, currency, line_items, seller_details,
          customer_details, issued_at, due_at, paid_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        `,
        [
          data.number,
          data.subscriptionId || null,
          data.scopeType,
          data.scopeId,
          data.status,
          data.amountMinor,
          data.currency,
          JSON.stringify(data.lineItems || []),
          JSON.stringify(data.sellerDetails || {}),
          JSON.stringify(data.customerDetails || {}),
          data.issuedAt || null,
          data.dueAt || null,
          data.paidAt || null,
        ]
      );
      return result.rows[0];
    },

    async listInvoicesForScope(scopeType, scopeId, { limit = 50, cursor = null } = {}) {
      const params = [scopeType, scopeId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND issued_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM billing_invoices
        WHERE billing_scope_type = $1 AND billing_scope_id = $2
          ${cursorClause}
        ORDER BY issued_at DESC NULLS LAST
        LIMIT $3
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.issued_at?.toISOString() : null,
      };
    },

    async findInvoiceById(id) {
      const result = await db.query(
        `SELECT * FROM billing_invoices WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * REFUNDS
     * ====================================================================== */

    async insertRefund(client, data) {
      const result = await client.query(
        `
        INSERT INTO refund_records (
          payment_id, amount_minor, currency, reason, status, requested_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.paymentId,
          data.amountMinor,
          data.currency,
          data.reason,
          data.status || 'requested',
          data.requestedBy || null,
        ]
      );
      return result.rows[0];
    },

    async updateRefund(id, fields) {
      const result = await db.query(
        `
        UPDATE refund_records
        SET status = COALESCE($2, status),
            provider_refund_reference = COALESCE($3, provider_refund_reference),
            decided_by = COALESCE($4, decided_by),
            decision_reason = COALESCE($5, decision_reason),
            decided_at = COALESCE($6, decided_at),
            completed_at = COALESCE($7, completed_at)
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          fields.status || null,
          fields.providerRefundReference || null,
          fields.decidedBy || null,
          fields.decisionReason || null,
          fields.decidedAt || null,
          fields.completedAt || null,
        ]
      );
      return result.rows[0] || null;
    },

    async findRefundById(id) {
      const result = await db.query(
        `SELECT * FROM refund_records WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listRefundsForPayment(paymentId) {
      const result = await db.query(
        `SELECT * FROM refund_records WHERE payment_id = $1 ORDER BY created_at DESC`,
        [paymentId]
      );
      return result.rows;
    },

    /* =========================================================================
     * ENTITLEMENTS
     * ====================================================================== */

    async listEntitlementsForScope(scopeType, scopeId) {
      const result = await db.query(
        `
        SELECT * FROM subscription_entitlements
        WHERE billing_scope_type = $1 AND billing_scope_id = $2
          AND revoked_at IS NULL
          AND valid_from <= now()
          AND (valid_until IS NULL OR valid_until > now())
        `,
        [scopeType, scopeId]
      );
      return result.rows;
    },

    async insertEntitlement(client, data) {
      const result = await client.query(
        `
        INSERT INTO subscription_entitlements (
          billing_scope_type, billing_scope_id, subscription_id,
          feature_key, value, source_type, valid_from, valid_until
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
        RETURNING *
        `,
        [
          data.scopeType,
          data.scopeId,
          data.subscriptionId || null,
          data.featureKey,
          JSON.stringify(data.value),
          data.sourceType || 'subscription',
          data.validFrom || new Date(),
          data.validUntil || null,
        ]
      );
      return result.rows[0];
    },

    async revokeEntitlementsForSubscription(subscriptionId) {
      await db.query(
        `
        UPDATE subscription_entitlements
        SET revoked_at = now()
        WHERE subscription_id = $1 AND revoked_at IS NULL
        `,
        [subscriptionId]
      );
    },

    /* =========================================================================
     * USAGE COUNTERS
     * ====================================================================== */

    async incrementUsageCounter({ scopeType, scopeId, dimension, amount, periodStart, periodEnd }) {
      const result = await db.query(
        `
        INSERT INTO subscription_usage_counters (
          billing_scope_type, billing_scope_id, usage_dimension,
          period_start, period_end, current_value
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (billing_scope_type, billing_scope_id, usage_dimension, period_start)
        DO UPDATE SET current_value = subscription_usage_counters.current_value + EXCLUDED.current_value,
                      updated_at = now()
        RETURNING *
        `,
        [scopeType, scopeId, dimension, periodStart, periodEnd, amount]
      );
      return result.rows[0];
    },

    async getUsageCounter({ scopeType, scopeId, dimension, periodStart }) {
      const result = await db.query(
        `
        SELECT * FROM subscription_usage_counters
        WHERE billing_scope_type = $1 AND billing_scope_id = $2
          AND usage_dimension = $3 AND period_start = $4
        `,
        [scopeType, scopeId, dimension, periodStart]
      );
      return result.rows[0] || null;
    },

    async listUsageCountersForScope({ scopeType, scopeId, periodStart, periodEnd }) {
      const result = await db.query(
        `
        SELECT usage_dimension, current_value
        FROM subscription_usage_counters
        WHERE billing_scope_type = $1 AND billing_scope_id = $2
          AND period_start >= $3 AND period_start < $4
        ORDER BY usage_dimension
        `,
        [scopeType, scopeId, periodStart, periodEnd]
      );
      return result.rows;
    },

    /* =========================================================================
     * WEBHOOK EVENTS
     * ====================================================================== */

    async insertWebhookEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO payment_webhook_events (
          provider, provider_event_id, event_type, payload, status
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (provider, provider_event_id) DO NOTHING
        RETURNING *
        `,
        [
          data.provider,
          data.providerEventId,
          data.eventType,
          JSON.stringify(data.payload),
          'pending',
        ]
      );
      return result.rows[0] || null;
    },

    async markWebhookEventProcessed(id, status = 'processed', errorMessage = null) {
      await db.query(
        `
        UPDATE payment_webhook_events
        SET status = $2, processed_at = now(), error_message = $3
        WHERE id = $1
        `,
        [id, status, errorMessage]
      );
    },
  };
}

export default createBillingQueries;