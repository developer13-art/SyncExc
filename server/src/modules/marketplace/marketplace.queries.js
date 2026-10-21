/**
 * SyncExc Server — Marketplace queries
 */

export function createMarketplaceQueries({ db }) {
  return {
    /* =========================================================================
     * PROVIDERS
     * ====================================================================== */

    async insertProvider(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_provider_profiles (
          user_id, workspace_id, handle, display_name, account_type, biography, methodology,
          supported_markets, supported_languages, moderation_state
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved')
        RETURNING *
        `,
        [
          data.userId,
          data.workspaceId,
          data.handle,
          data.displayName,
          data.accountType,
          data.biography || null,
          data.methodology || null,
          data.supportedMarkets || [],
          data.supportedLanguages || [],
        ]
      );
      return result.rows[0];
    },

    async findProviderById(providerId) {
      const result = await db.query(
        `SELECT * FROM marketplace_provider_profiles WHERE id = $1`,
        [providerId]
      );
      return result.rows[0] || null;
    },

    async isFollowing(providerId, followerUserId) {
      const result = await db.query(
        `
        SELECT 1
        FROM marketplace_follows
        WHERE provider_id = $1 AND follower_user_id = $2
        LIMIT 1
        `,
        [providerId, followerUserId]
      );
      return result.rowCount > 0;
    },

    async findProviderByHandle(handle) {
      const result = await db.query(
        `SELECT * FROM marketplace_provider_profiles WHERE handle = $1`,
        [handle]
      );
      return result.rows[0] || null;
    },

    async findProviderByUserId(userId) {
      const result = await db.query(
        `SELECT * FROM marketplace_provider_profiles WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    },

    async findProviderByWorkspaceId(workspaceId) {
      const result = await db.query(
        `SELECT * FROM marketplace_provider_profiles WHERE workspace_id = $1`,
        [workspaceId]
      );
      return result.rows[0] || null;
    },

    async getProviderDashboard(providerId) {
      const result = await db.query(
        `
        SELECT
          (SELECT count(*)::int FROM marketplace_subscriptions
           WHERE provider_id = $1 AND status IN ('active', 'trialing')) AS active_subscribers,
          (SELECT count(*)::int FROM marketplace_published_signals
           WHERE provider_id = $1) AS total_signals,
          (SELECT count(*)::int FROM marketplace_published_signals
           WHERE provider_id = $1 AND status IN ('published', 'updated')) AS active_signals,
          (SELECT count(*)::int FROM marketplace_provider_plans
           WHERE provider_id = $1 AND status = 'active') AS active_plans
        `,
        [providerId],
      );
      return result.rows[0];
    },

    async listProviderSubscribers(providerId) {
      const result = await db.query(
        `
        SELECT s.id, s.status, s.created_at,
               u.username, u.display_name,
               plan.name AS plan_name, plan.pricing
        FROM marketplace_subscriptions s
        JOIN users u ON u.id = s.subscriber_user_id
        LEFT JOIN marketplace_provider_plans plan ON plan.id = s.plan_id
        WHERE s.provider_id = $1 AND s.status IN ('active', 'trialing')
          AND u.deleted_at IS NULL
        ORDER BY s.created_at DESC
        `,
        [providerId],
      );
      return result.rows;
    },

    async listProviders({ moderationState, limit = 50, cursor = null, search = null, markets = null } = {}) {
      const params = [limit + 1];
      const conditions = ["moderation_state = 'approved'", "visibility = 'public'"];
      if (moderationState) {
        conditions[0] = `moderation_state = $${params.length + 1}`;
        params.push(moderationState);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(display_name ILIKE $${params.length} OR handle ILIKE $${params.length} OR biography ILIKE $${params.length})`
        );
      }
      if (markets?.length) {
        params.push(markets);
        conditions.push(`supported_markets && $${params.length}::text[]`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`created_at < $${params.length}`);
      }
      const result = await db.query(
        `
        SELECT * FROM marketplace_provider_profiles
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $1
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

    async updateProvider(providerId, fields, client = db) {
      const result = await client.query(
        `
        UPDATE marketplace_provider_profiles
        SET display_name = COALESCE($2, display_name),
            biography = COALESCE($3, biography),
            methodology = COALESCE($4, methodology),
            supported_markets = COALESCE($5, supported_markets),
            supported_languages = COALESCE($6, supported_languages),
            avatar_url = COALESCE($7, avatar_url),
            visibility = COALESCE($8, visibility),
            cover_image_url = COALESCE($9, cover_image_url),
            current_version = current_version + 1,
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          providerId,
          fields.displayName ?? null,
          fields.biography ?? null,
          fields.methodology ?? null,
          fields.supportedMarkets ?? null,
          fields.supportedLanguages ?? null,
          fields.avatarUrl ?? null,
          fields.visibility ?? null,
          fields.coverImageUrl ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async updateProviderModerationState(providerId, state) {
      const result = await db.query(
        `
        UPDATE marketplace_provider_profiles
        SET moderation_state = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [providerId, state]
      );
      return result.rows[0] || null;
    },

    async insertProviderProfileVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_provider_profile_versions (provider_id, version, snapshot)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.providerId, data.version, JSON.stringify(data.snapshot)]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * PUBLISHED SIGNALS
     * ====================================================================== */

    async insertPublishedSignal(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_published_signals (
          provider_id, source_signal_id, instrument, market_type, direction,
          entry, entry_range, stop_loss, leverage, status, valid_until, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11)
        RETURNING *
        `,
        [
          data.providerId,
          data.sourceSignalId || null,
          data.instrument,
          data.marketType,
          data.direction,
          data.entry || null,
          data.entryRange ? JSON.stringify(data.entryRange) : null,
          data.stopLoss || null,
          data.leverage || null,
          data.validUntil || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async findPublishedSignalById(signalId) {
      const result = await db.query(
        `SELECT * FROM marketplace_published_signals WHERE id = $1`,
        [signalId]
      );
      return result.rows[0] || null;
    },

    async listPublishedSignals({ providerId, status, publicOnly = false, limit = 50, cursor = null } = {}) {
      const params = [limit + 1];
      const conditions = [];
      if (providerId) {
        params.push(providerId);
        conditions.push(`signal.provider_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`signal.status = $${params.length}`);
      }
      if (publicOnly) {
        conditions.push(`signal.status IN ('published', 'updated')`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`signal.created_at < $${params.length}`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await db.query(
        `
        SELECT signal.*,
               latest_version.snapshot->'targets' AS targets,
               latest_version.snapshot->'disclosures' AS disclosures
        FROM marketplace_published_signals signal
        LEFT JOIN LATERAL (
          SELECT snapshot
          FROM marketplace_published_signal_versions
          WHERE signal_id = signal.id
          ORDER BY version DESC
          LIMIT 1
        ) latest_version ON true
        ${where}
        ORDER BY signal.created_at DESC
        LIMIT $1
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

    async updatePublishedSignal(signalId, fields, bumpVersion = false, client = db) {
      const result = await client.query(
        `
        UPDATE marketplace_published_signals
        SET instrument = COALESCE($2, instrument),
            market_type = COALESCE($3, market_type),
            direction = COALESCE($4, direction),
            entry = COALESCE($5, entry),
            entry_range = COALESCE($6, entry_range),
            stop_loss = COALESCE($7, stop_loss),
            leverage = COALESCE($8, leverage),
            status = COALESCE($9, status),
            valid_until = COALESCE($10, valid_until),
            current_version = current_version + CASE WHEN $11::boolean THEN 1 ELSE 0 END,
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          signalId,
          fields.instrument ?? null,
          fields.marketType ?? null,
          fields.direction ?? null,
          fields.entry ?? null,
          fields.entryRange ? JSON.stringify(fields.entryRange) : null,
          fields.stopLoss ?? null,
          fields.leverage ?? null,
          fields.status ?? null,
          fields.validUntil ?? null,
          bumpVersion,
        ]
      );
      return result.rows[0] || null;
    },

    async insertPublishedSignalVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_published_signal_versions (
          signal_id, version, snapshot, change_reason
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (signal_id, version) DO NOTHING
        RETURNING *
        `,
        [data.signalId, data.version, JSON.stringify(data.snapshot), data.changeReason || null]
      );
      return result.rows[0] || null;
    },

    async insertPublication(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_signal_publications (signal_id, channel, visibility)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.signalId, data.channel, data.visibility]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * DISCLOSURES
     * ====================================================================== */

    async insertDisclosure(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_signal_disclosures (provider_id, scope, version, content)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.providerId, data.scope, data.version, data.content]
      );
      return result.rows[0];
    },

    async listDisclosuresForProvider(providerId) {
      const result = await db.query(
        `
        SELECT * FROM marketplace_signal_disclosures
        WHERE provider_id = $1
        ORDER BY created_at DESC
        `,
        [providerId]
      );
      return result.rows;
    },

    async insertDisclosureAcceptance(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_disclosure_acceptances (disclosure_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (disclosure_id, user_id) DO NOTHING
        RETURNING *
        `,
        [data.disclosureId, data.userId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * PROVIDER PLANS
     * ====================================================================== */

    async insertProviderPlan(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_provider_plans (provider_id, name, pricing, entitlements, status)
        VALUES ($1, $2, $3, $4, 'draft')
        RETURNING *
        `,
        [
          data.providerId,
          data.name,
          JSON.stringify(data.pricing),
          JSON.stringify(data.entitlements || {}),
        ]
      );
      return result.rows[0];
    },

    async findProviderPlanById(planId) {
      const result = await db.query(
        `SELECT * FROM marketplace_provider_plans WHERE id = $1`,
        [planId],
      );
      return result.rows[0] || null;
    },

    async listManagedProviderPlans(providerId) {
      const result = await db.query(
        `
        SELECT * FROM marketplace_provider_plans
        WHERE provider_id = $1 AND status <> 'archived'
        ORDER BY created_at DESC
        `,
        [providerId],
      );
      return result.rows;
    },

    async insertProviderPlanVersion(client, plan) {
      const result = await client.query(
        `
        INSERT INTO marketplace_provider_plan_versions (plan_id, version, snapshot)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [plan.id, plan.version, JSON.stringify(plan)],
      );
      return result.rows[0];
    },

    async updateProviderPlanStatus(providerId, planId, status, client = db) {
      const result = await client.query(
        `
        UPDATE marketplace_provider_plans
        SET status = $3, version = version + 1, updated_at = now()
        WHERE provider_id = $1 AND id = $2
        RETURNING *
        `,
        [providerId, planId, status],
      );
      return result.rows[0] || null;
    },

    async listProviderPlans(providerId) {
      const result = await db.query(
        `
        SELECT * FROM marketplace_provider_plans
        WHERE provider_id = $1 AND status = 'active'
        ORDER BY created_at ASC
        `,
        [providerId]
      );
      return result.rows;
    },

    /* =========================================================================
     * FOLLOWS
     * ====================================================================== */

    async insertFollow(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_follows (provider_id, follower_user_id)
        VALUES ($1, $2)
        ON CONFLICT (provider_id, follower_user_id) DO NOTHING
        RETURNING *
        `,
        [data.providerId, data.followerUserId]
      );
      return result.rows[0] || null;
    },

    async removeFollow(providerId, followerUserId) {
      const result = await db.query(
        `
        DELETE FROM marketplace_follows
        WHERE provider_id = $1 AND follower_user_id = $2
        RETURNING id
        `,
        [providerId, followerUserId]
      );
      return result.rowCount > 0;
    },

    async listFollowsForUser(userId) {
      const result = await db.query(
        `
        SELECT f.*, p.handle, p.display_name, p.moderation_state
        FROM marketplace_follows f
        JOIN marketplace_provider_profiles p ON p.id = f.provider_id
        WHERE f.follower_user_id = $1
        ORDER BY f.created_at DESC
        `,
        [userId]
      );
      return result.rows;
    },

    async countFollowers(providerId) {
      const result = await db.query(
        `SELECT count(*)::int AS count FROM marketplace_follows WHERE provider_id = $1`,
        [providerId]
      );
      return result.rows[0].count;
    },

    /* =========================================================================
     * SUBSCRIPTIONS
     * ====================================================================== */

    async insertSubscription(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_subscriptions (
          provider_id, plan_id, subscriber_user_id, workspace_id, status
        )
        VALUES ($1, $2, $3, $4, 'subscription_pending')
        RETURNING *
        `,
        [
          data.providerId,
          data.planId || null,
          data.subscriberUserId,
          data.workspaceId || null,
        ]
      );
      return result.rows[0];
    },

    async findActiveSubscription(providerId, subscriberUserId) {
      const result = await db.query(
        `
        SELECT * FROM marketplace_subscriptions
        WHERE provider_id = $1 AND subscriber_user_id = $2
          AND status IN ('active', 'trialing')
        LIMIT 1
        `,
        [providerId, subscriberUserId]
      );
      return result.rows[0] || null;
    },

    async listSubscriptionsForUser(userId) {
      const result = await db.query(
        `
        SELECT s.*, p.handle, p.display_name
        FROM marketplace_subscriptions s
        JOIN marketplace_provider_profiles p ON p.id = s.provider_id
        WHERE s.subscriber_user_id = $1
        ORDER BY s.created_at DESC
        `,
        [userId]
      );
      return result.rows;
    },

    async updateSubscriptionStatus(subscriptionId, status) {
      const result = await db.query(
        `
        UPDATE marketplace_subscriptions
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [subscriptionId, status]
      );
      return result.rows[0] || null;
    },

    async insertSubscriptionEvent(client, data) {
      await client.query(
        `
        INSERT INTO marketplace_subscription_events (subscription_id, event_type, metadata)
        VALUES ($1, $2, $3)
        `,
        [data.subscriptionId, data.eventType, JSON.stringify(data.metadata || {})]
      );
    },

    /* =========================================================================
     * COPY CONFIGURATIONS
     * ====================================================================== */

    async insertCopyConfiguration(client, data) {
      const result = await client.query(
        `
        INSERT INTO copy_configurations (
          workspace_id, provider_id, provider_plan_id, sizing_rule,
          instrument_filters, market_types, execution_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.providerId,
          data.providerPlanId || null,
          JSON.stringify(data.sizingRule),
          data.instrumentFilters || [],
          data.marketTypes,
          data.executionMode,
        ]
      );
      return result.rows[0];
    },

    async findCopyConfigurationById(configId) {
      const result = await db.query(
        `SELECT * FROM copy_configurations WHERE id = $1`,
        [configId]
      );
      return result.rows[0] || null;
    },

    async listCopyConfigurationsForWorkspace(workspaceId, { status } = {}) {
      const params = [workspaceId];
      let statusClause = '';
      if (status) {
        params.push(status);
        statusClause = `AND status = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT c.*, p.handle AS provider_handle, p.display_name AS provider_name
        FROM copy_configurations c
        JOIN marketplace_provider_profiles p ON p.id = c.provider_id
        WHERE c.workspace_id = $1 ${statusClause}
        ORDER BY c.created_at DESC
        `,
        params
      );
      return result.rows;
    },

    async listActiveCopyConfigurationsForProvider(providerId) {
      const result = await db.query(
        `
        SELECT c.*, w.id AS workspace_id FROM copy_configurations c
        JOIN workspaces w ON w.id = c.workspace_id
        WHERE c.provider_id = $1 AND c.status = 'active'
        `,
        [providerId]
      );
      return result.rows;
    },

    async updateCopyConfiguration(configId, fields) {
      const result = await db.query(
        `
        UPDATE copy_configurations
        SET status = COALESCE($2, status),
            sizing_rule = COALESCE($3, sizing_rule),
            execution_mode = COALESCE($4, execution_mode),
            instrument_filters = COALESCE($5, instrument_filters),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          configId,
          fields.status ?? null,
          fields.sizingRule ? JSON.stringify(fields.sizingRule) : null,
          fields.executionMode ?? null,
          fields.instrumentFilters ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertCopyConfigurationVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO copy_configuration_versions (config_id, version, snapshot)
        VALUES ($1, $2, $3)
        ON CONFLICT (config_id, version) DO NOTHING
        RETURNING *
        `,
        [data.configId, data.version, JSON.stringify(data.snapshot)]
      );
      return result.rows[0] || null;
    },

    async insertCopyDestination(client, data) {
      const result = await client.query(
        `
        INSERT INTO copy_destination_accounts (config_id, connection_id, account_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (config_id, account_id) DO NOTHING
        RETURNING *
        `,
        [data.configId, data.connectionId, data.accountId]
      );
      return result.rows[0] || null;
    },

    async listCopyDestinations(configId) {
      const result = await db.query(
        `
        SELECT d.*, c.exchange_code, c.status AS connection_status
        FROM copy_destination_accounts d
        JOIN exchange_connections c ON c.id = d.connection_id
        WHERE d.config_id = $1
        `,
        [configId]
      );
      return result.rows;
    },

    async insertCopyPermissionGrant(client, data) {
      const result = await client.query(
        `
        INSERT INTO copy_permission_grants (config_id, granted_by, scope)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.configId, data.grantedBy, JSON.stringify(data.scope || {})]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * COPY PROCESSING RECORDS
     * ====================================================================== */

    async insertCopyProcessingRecord(client, data) {
      const result = await client.query(
        `
        INSERT INTO copy_signal_processing_records (
          published_signal_id, config_id, subscriber_user_id, config_version,
          outcome, skip_reason, allocation_decision, risk_evaluation_id,
          execution_intent_id, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *
        `,
        [
          data.publishedSignalId,
          data.configId,
          data.subscriberUserId,
          data.configVersion,
          data.outcome,
          data.skipReason || null,
          data.allocationDecision ? JSON.stringify(data.allocationDecision) : null,
          data.riskEvaluationId || null,
          data.executionIntentId || null,
          data.idempotencyKey,
        ]
      );
      return result.rows[0] || null;
    },

    async updateCopyProcessingRecord(recordId, fields) {
      const result = await db.query(
        `
        UPDATE copy_signal_processing_records
        SET outcome = COALESCE($2, outcome),
            skip_reason = COALESCE($3, skip_reason),
            allocation_decision = COALESCE($4, allocation_decision),
            risk_evaluation_id = COALESCE($5, risk_evaluation_id),
            execution_intent_id = COALESCE($6, execution_intent_id)
        WHERE id = $1
        RETURNING *
        `,
        [
          recordId,
          fields.outcome ?? null,
          fields.skipReason ?? null,
          fields.allocationDecision ? JSON.stringify(fields.allocationDecision) : null,
          fields.riskEvaluationId ?? null,
          fields.executionIntentId ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async listCopyProcessingRecordsForWorkspace(workspaceId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT r.*, c.workspace_id, p.handle AS provider_handle
        FROM copy_signal_processing_records r
        JOIN copy_configurations c ON c.id = r.config_id
        JOIN marketplace_provider_profiles p ON p.id = c.provider_id
        WHERE c.workspace_id = $1
        ORDER BY r.processing_timestamp DESC
        LIMIT $2
        `,
        [workspaceId, limit]
      );
      return result.rows;
    },

    async insertCopyDestinationResult(client, data) {
      const result = await client.query(
        `
        INSERT INTO copy_signal_destination_results (
          processing_record_id, destination_account_id, outcome, skip_reason,
          destination_order_id, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.processingRecordId,
          data.destinationAccountId,
          data.outcome,
          data.skipReason || null,
          data.destinationOrderId || null,
          data.errorMessage || null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * PERFORMANCE
     * ====================================================================== */

    async insertPerformanceReport(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_performance_reports (
          provider_id, methodology_version, period_start, period_end, metrics, completeness
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (provider_id, methodology_version, period_start, period_end) DO NOTHING
        RETURNING *
        `,
        [
          data.providerId,
          data.methodologyVersion,
          data.periodStart,
          data.periodEnd,
          JSON.stringify(data.metrics),
          data.completeness ? JSON.stringify(data.completeness) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async listPerformanceReports(providerId, { limit = 20 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM marketplace_performance_reports
        WHERE provider_id = $1
        ORDER BY period_end DESC
        LIMIT $2
        `,
        [providerId, limit]
      );
      return result.rows;
    },

    async insertPerformanceObservation(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_performance_observations (
          signal_id, observed_at, outcome, evidence
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.signalId,
          data.observedAt,
          data.outcome || null,
          data.evidence ? JSON.stringify(data.evidence) : null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * MODERATION
     * ====================================================================== */

    async insertModerationCase(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_moderation_cases (
          provider_id, signal_id, state, category
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.providerId || null,
          data.signalId || null,
          data.state || 'pending_review',
          data.category || null,
        ]
      );
      return result.rows[0];
    },

    async insertModerationEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_moderation_events (
          case_id, actor_id, action, reason, evidence
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.caseId,
          data.actorId || null,
          data.action,
          data.reason || null,
          data.evidence ? JSON.stringify(data.evidence) : null,
        ]
      );
      return result.rows[0];
    },

    async findModerationCaseById(id) {
      const result = await db.query(
        `SELECT * FROM marketplace_moderation_cases WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async updateModerationCaseState(caseId, state) {
      const result = await db.query(
        `
        UPDATE marketplace_moderation_cases
        SET state = $2, closed_at = CASE WHEN $2 IN ('resolved', 'rejected') THEN now() ELSE closed_at END
        WHERE id = $1
        RETURNING *
        `,
        [caseId, state]
      );
      return result.rows[0] || null;
    },

    async listModerationCases({ state, limit = 50, cursor = null } = {}) {
      const params = [limit + 1];
      const conditions = [];
      if (state) {
        params.push(state);
        conditions.push(`state = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`opened_at < $${params.length}`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await db.query(
        `
        SELECT * FROM marketplace_moderation_cases
        ${where}
        ORDER BY opened_at DESC
        LIMIT $1
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.opened_at.toISOString() : null,
      };
    },
  };
}

export default createMarketplaceQueries;