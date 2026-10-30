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

    async findPublishedSignalBySourceOrderId(sourceOrderId) {
      const result = await db.query(
        `SELECT id FROM marketplace_published_signals WHERE source_order_id = $1`,
        [sourceOrderId]
      );
      return result.rows[0] || null;
    },

    async findPublishedSignalBySourcePositionSnapshotId(snapshotId) {
      const result = await db.query(
        `SELECT id FROM marketplace_published_signals WHERE source_position_snapshot_id = $1`,
        [snapshotId]
      );
      return result.rows[0] || null;
    },

    async findPublishedSignalBySourceClosedTradeId(closedTradeId, client = db) {
      const result = await client.query(
        `SELECT * FROM marketplace_published_signals WHERE source_closed_trade_id = $1`,
        [closedTradeId],
      );
      return result.rows[0] || null;
    },

    async listTraderTradeSyncTargets() {
      const result = await db.query(
        `
        SELECT DISTINCT
          connection.workspace_id,
          account.id AS account_id
        FROM marketplace_provider_profiles provider
        JOIN exchange_connections connection
          ON connection.owner_id = provider.user_id
         AND connection.workspace_id = provider.workspace_id
        JOIN exchange_accounts account ON account.connection_id = connection.id
        WHERE provider.visibility = 'public'
          AND provider.moderation_state = 'approved'
          AND connection.status = 'active'
          AND account.status = 'active'
        ORDER BY connection.workspace_id, account.id
        `,
      );
      return result.rows;
    },

    async findProviderForPositionPublication(workspaceId) {
      const result = await db.query(
        `
        SELECT id, user_id, workspace_id
        FROM marketplace_provider_profiles
        WHERE workspace_id = $1
          AND visibility = 'public'
          AND moderation_state = 'approved'
        `,
        [workspaceId]
      );
      return result.rows[0] || null;
    },

    async findOrderForAutoPublication(orderId) {
      const result = await db.query(
        `
        SELECT
          orders.id,
          orders.workspace_id,
          orders.account_id,
          orders.instrument,
          orders.market_type,
          orders.side,
          orders.type,
          orders.average_fill_price,
          orders.created_at,
          provider.id AS provider_id,
          provider.user_id
        FROM trading_orders orders
        JOIN marketplace_provider_profiles provider
          ON provider.workspace_id = orders.workspace_id
        WHERE orders.id = $1
          AND orders.status = 'filled'
          AND NOT EXISTS (
            SELECT 1
            FROM marketplace_trader_signal_executions signal_execution
            WHERE signal_execution.order_id = orders.id
          )
          AND provider.visibility = 'public'
          AND provider.moderation_state = 'approved'
        `,
        [orderId]
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

    async getTraderSignalExecutionPercentage(userId) {
      const result = await db.query(
        `SELECT trading_preferences->>'signalExecutionPercentage' AS percentage
         FROM user_preferences WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0]?.percentage ?? null;
    },

    async listTraderSignalExecutionAccounts(userId, workspaceId, accountIds = null) {
      const result = await db.query(
        `
        SELECT
          connection.id AS connection_id,
          connection.exchange_code,
          connection.environment,
          connection.status AS connection_status,
          account.id AS account_id,
          account.account_type,
          account.status AS account_status
        FROM exchange_connections connection
        JOIN exchange_accounts account ON account.connection_id = connection.id
        WHERE connection.owner_id = $1
          AND connection.workspace_id = $2
          AND ($3::uuid[] IS NULL OR account.id = ANY($3::uuid[]))
        ORDER BY connection.created_at, account.created_at
        `,
        [userId, workspaceId, accountIds]
      );
      return result.rows;
    },

    async recordTraderSignalExecution(client, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_trader_signal_executions (
          signal_id, workspace_id, user_id, connection_id, account_id,
          execution_request_id, order_id, status, requested_quantity, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (signal_id, account_id) DO UPDATE SET
          execution_request_id = COALESCE(EXCLUDED.execution_request_id, marketplace_trader_signal_executions.execution_request_id),
          order_id = COALESCE(EXCLUDED.order_id, marketplace_trader_signal_executions.order_id),
          status = EXCLUDED.status,
          requested_quantity = COALESCE(EXCLUDED.requested_quantity, marketplace_trader_signal_executions.requested_quantity),
          error_message = EXCLUDED.error_message,
          updated_at = now()
        RETURNING *
        `,
        [
          data.signalId,
          data.workspaceId,
          data.userId,
          data.connectionId,
          data.accountId,
          data.executionRequestId || null,
          data.orderId || null,
          data.status,
          data.requestedQuantity || null,
          data.errorMessage || null,
        ],
      );
      return result.rows[0];
    },

    async updateTraderSignalExecutionByOrder(orderId, status) {
      const result = await db.query(
        `UPDATE marketplace_trader_signal_executions
         SET status = $2, updated_at = now()
         WHERE order_id = $1
         RETURNING *`,
        [orderId, status],
      );
      return result.rows;
    },

    async updateCopyExecutionByOrder(orderId, status, errorMessage = null) {
      const settled = ['filled', 'partially_filled'].includes(status);
      const failed = ['rejected', 'failed', 'canceled', 'cancelled', 'expired'].includes(status);
      const outcome = settled ? 'executed' : failed ? 'failed' : 'pending';
      const intentStatus = settled ? status : failed ? status : 'submitted';
      return db.tx(async (tx) => {
        const destinations = await tx.query(
          `
          UPDATE copy_signal_destination_results
          SET outcome = $2,
              error_message = COALESCE($3, error_message)
          WHERE destination_order_id = $1
          RETURNING processing_record_id
          `,
          [orderId, outcome, errorMessage],
        );
        if (destinations.rowCount === 0) return [];
        const recordIds = destinations.rows.map((row) => row.processing_record_id);
        await tx.query(
          `UPDATE copy_signal_processing_records SET outcome = $2
           WHERE id = ANY($1::uuid[])`,
          [recordIds, outcome],
        );
        await tx.query(
          `
          UPDATE copy_execution_intents intent
          SET status = $2
          FROM copy_signal_processing_records record
          WHERE record.execution_intent_id = intent.id
            AND record.id = ANY($1::uuid[])
          `,
          [recordIds, intentStatus],
        );
        return recordIds;
      });
    },

    async findSignalExecutionForClosedTrade({ accountId, exchangeOrderId, instrument }) {
      if (!exchangeOrderId) return null;
      const result = await db.query(
        `
        SELECT execution.*, signal.provider_id
        FROM marketplace_trader_signal_executions execution
        JOIN trading_orders order_row ON order_row.id = execution.order_id
        JOIN marketplace_published_signals signal ON signal.id = execution.signal_id
        WHERE execution.account_id = $1
          AND order_row.exchange_order_id = $2
          AND order_row.instrument = $3
          AND execution.status IN ('filled', 'partially_filled', 'closed')
        LIMIT 1
        `,
        [accountId, exchangeOrderId, instrument],
      );
      return result.rows[0] || null;
    },

    async insertSignalExecutionClosedTrade(client, {
      executionId,
      closedTradeId,
      realizedPnl,
      pnlAsset,
      closedAt,
    }) {
      const result = await client.query(
        `
        INSERT INTO marketplace_signal_closed_trades (
          signal_execution_id, closed_trade_id, realized_pnl, pnl_asset, closed_at
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (closed_trade_id) DO NOTHING
        RETURNING *
        `,
        [executionId, closedTradeId, realizedPnl, pnlAsset || null, closedAt],
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

    async findProviderByStripeAccountId(accountId, client = db) {
      const result = await client.query(
        `SELECT * FROM marketplace_provider_profiles WHERE stripe_connect_account_id = $1`,
        [accountId]
      );
      return result.rows[0] || null;
    },

    async updateProviderStripeAccount(providerId, fields, client = db) {
      const result = await client.query(
        `
        UPDATE marketplace_provider_profiles
        SET stripe_connect_account_id = COALESCE($2, stripe_connect_account_id),
            stripe_country = COALESCE($3, stripe_country),
            stripe_details_submitted = COALESCE($4, stripe_details_submitted),
            stripe_transfers_enabled = COALESCE($5, stripe_transfers_enabled),
            stripe_payouts_enabled = COALESCE($6, stripe_payouts_enabled),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          providerId,
          fields.accountId ?? null,
          fields.country ?? null,
          fields.detailsSubmitted ?? null,
          fields.transfersEnabled ?? null,
          fields.payoutsEnabled ?? null,
        ]
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
      const conditions = ["provider.moderation_state = 'approved'", "provider.visibility = 'public'"];
      if (moderationState) {
        conditions[0] = `provider.moderation_state = $${params.length + 1}`;
        params.push(moderationState);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(provider.display_name ILIKE $${params.length} OR provider.handle ILIKE $${params.length} OR provider.biography ILIKE $${params.length})`
        );
      }
      if (markets?.length) {
        params.push(markets);
        conditions.push(`provider.supported_markets && $${params.length}::text[]`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`provider.created_at < $${params.length}`);
      }
      const result = await db.query(
        `
        SELECT provider.*,
               (SELECT count(*)::int
                FROM marketplace_subscriptions subscription
                WHERE subscription.provider_id = provider.id
                  AND subscription.status IN ('active', 'trialing')) AS subscriber_count,
               (SELECT count(*)::int
                FROM marketplace_published_signals signal
                WHERE signal.provider_id = provider.id
                  AND signal.status IN ('published', 'updated')) AS signal_count
        FROM marketplace_provider_profiles provider
        WHERE ${conditions.join(' AND ')}
        ORDER BY provider.created_at DESC
        LIMIT $1
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

      if (rows.length > 0) {
        const migrationResult = await db.query(
          `SELECT EXISTS (
             SELECT 1
             FROM schema_migrations
             WHERE COALESCE(
               to_jsonb(schema_migrations)->>'filename',
               to_jsonb(schema_migrations)->>'name'
             ) = $1
           ) AS applied`,
          ['045_marketplace_trade_lifecycle.sql'],
        );
        if (migrationResult.rows[0]?.applied) {
          const pnlResult = await db.query(
            `
            WITH execution_pnl AS (
              SELECT
                signal.provider_id,
                execution.id AS execution_id,
                COALESCE(NULLIF(closed_trade.pnl_asset, ''), NULLIF(exchange_trade.fee_asset, ''), 'UNKNOWN') AS pnl_asset,
                SUM(exchange_trade.realized_pnl) AS realized_pnl
              FROM marketplace_signal_closed_trades closed_trade
              JOIN trading_closed_trades exchange_trade
                ON exchange_trade.id = closed_trade.closed_trade_id
              JOIN marketplace_trader_signal_executions execution
                ON execution.id = closed_trade.signal_execution_id
              JOIN marketplace_published_signals signal ON signal.id = execution.signal_id
              WHERE signal.provider_id = ANY($1::uuid[])
                AND signal.source_account_id IS NULL
              GROUP BY
                signal.provider_id,
                execution.id,
                COALESCE(NULLIF(closed_trade.pnl_asset, ''), NULLIF(exchange_trade.fee_asset, ''), 'UNKNOWN')
            ),
            source_signal_pnl AS (
              SELECT
                signal.provider_id,
                signal.id AS execution_id,
                COALESCE(NULLIF(signal.pnl_asset, ''), MAX(NULLIF(exchange_trade.fee_asset, '')), 'UNKNOWN') AS pnl_asset,
                SUM(exchange_trade.realized_pnl) AS realized_pnl
              FROM marketplace_published_signals signal
              JOIN trading_closed_trades exchange_trade
                ON (
                  (
                    signal.source_closed_trade_id IS NOT NULL
                    AND exchange_trade.id = signal.source_closed_trade_id
                  )
                  OR (
                    signal.source_closed_trade_id IS NULL
                    AND (signal.source_order_id IS NOT NULL OR signal.source_position_snapshot_id IS NOT NULL)
                    AND exchange_trade.account_id = signal.source_account_id
                    AND exchange_trade.instrument = signal.instrument
                    AND exchange_trade.side = signal.direction
                    AND exchange_trade.closed_at >= signal.entry_time
                    AND exchange_trade.closed_at <= signal.closed_at
                  )
                )
              WHERE signal.provider_id = ANY($1::uuid[])
                AND signal.source_account_id IS NOT NULL
                AND signal.status = 'closed'
                AND signal.closed_at IS NOT NULL
              GROUP BY
                signal.provider_id,
                signal.id,
                signal.pnl_asset
            ),
            all_pnl AS (
              SELECT * FROM execution_pnl
              UNION ALL
              SELECT * FROM source_signal_pnl
            )
            SELECT
              provider_id,
              pnl_asset,
              SUM(realized_pnl)::text AS net_pnl,
              count(*)::int AS observed_executions,
              count(*) FILTER (WHERE realized_pnl > 0)::int AS wins
            FROM all_pnl
            GROUP BY provider_id, pnl_asset
            ORDER BY provider_id, pnl_asset
            `,
            [rows.map((provider) => provider.id)],
          );
          const pnlByProvider = new Map();
          for (const pnl of pnlResult.rows) {
            const providerPnl = pnlByProvider.get(pnl.provider_id) || [];
            providerPnl.push({
              asset: pnl.pnl_asset,
              netPnl: pnl.net_pnl,
              observedExecutions: pnl.observed_executions,
              wins: pnl.wins,
            });
            pnlByProvider.set(pnl.provider_id, providerPnl);
          }
          for (const provider of rows) {
            provider.realized_pnl_by_asset = pnlByProvider.get(provider.id) || [];
          }
        }
      }

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
            auto_publish_trades = COALESCE($10, auto_publish_trades),
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
          fields.autoPublishTrades ?? null,
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
          provider_id, source_signal_id, instrument, market_type, direction, order_type,
          entry_time, entry, entry_range, stop_loss, leverage, status, valid_until, metadata,
          source_order_id, source_position_snapshot_id, source_account_id, source_closed_trade_id,
          realized_pnl, pnl_asset, closed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (source_closed_trade_id) DO NOTHING
        RETURNING *
        `,
        [
          data.providerId,
          data.sourceSignalId || null,
          data.instrument,
          data.marketType,
          data.direction,
          data.orderType || 'market',
          data.entryTime || null,
          data.entry || null,
          data.entryRange ? JSON.stringify(data.entryRange) : null,
          data.stopLoss || null,
          data.leverage || null,
          data.status || 'draft',
          data.validUntil || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.sourceOrderId || null,
          data.sourcePositionSnapshotId || null,
          data.sourceAccountId || null,
          data.sourceClosedTradeId || null,
          data.realizedPnl ?? null,
          data.pnlAsset || null,
          data.closedAt || null,
        ]
      );
      return result.rows[0];
    },

    async findPublishedSignalById(signalId) {
      const result = await db.query(
        `SELECT signal.*, provider.user_id, provider.workspace_id,
                COALESCE(latest_version.snapshot->'targets', '[]'::jsonb) AS targets
         FROM marketplace_published_signals signal
         JOIN marketplace_provider_profiles provider ON provider.id = signal.provider_id
         LEFT JOIN LATERAL (
           SELECT snapshot
           FROM marketplace_published_signal_versions
           WHERE signal_id = signal.id
           ORDER BY version DESC
           LIMIT 1
         ) latest_version ON true
         WHERE signal.id = $1`,
        [signalId]
      );
      return result.rows[0] || null;
    },

    async canAccessSignalDiscussion(signalId, userId) {
      const result = await db.query(
        `
        SELECT signal.id
        FROM marketplace_published_signals signal
        JOIN marketplace_provider_profiles provider ON provider.id = signal.provider_id
        WHERE signal.id = $1
          AND signal.status IN ('published', 'updated', 'closed')
          AND (
            provider.user_id = $2
            OR EXISTS (
              SELECT 1 FROM marketplace_subscriptions subscription
              WHERE subscription.provider_id = provider.id
                AND subscription.subscriber_user_id = $2
                AND subscription.status IN ('active', 'trialing')
            )
          )
        `,
        [signalId, userId]
      );
      return result.rowCount > 0;
    },

    async listSignalComments(signalId) {
      const result = await db.query(
        `
        SELECT comment.id, comment.signal_id, comment.user_id, comment.content,
               comment.proof_name, comment.proof_mime_type, comment.created_at,
               users.display_name, users.username
        FROM marketplace_signal_comments comment
        JOIN users ON users.id = comment.user_id
        WHERE comment.signal_id = $1
        ORDER BY comment.created_at ASC
        `,
        [signalId]
      );
      return result.rows;
    },

    async findSignalComment(commentId) {
      const result = await db.query(
        `SELECT * FROM marketplace_signal_comments WHERE id = $1`,
        [commentId]
      );
      return result.rows[0] || null;
    },

    async insertSignalComment(data) {
      const result = await db.query(
        `
        INSERT INTO marketplace_signal_comments
          (signal_id, user_id, content, proof_data, proof_name, proof_mime_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, signal_id, user_id, content, proof_name, proof_mime_type, created_at
        `,
        [
          data.signalId,
          data.userId,
          data.content,
          data.proofData,
          data.proofName,
          data.proofMimeType,
        ]
      );
      return result.rows[0];
    },

    async listPublishedSignals({
      providerId,
      status,
      publicOnly = false,
      includeTraderExecution = false,
      limit = 50,
      cursor = null,
    } = {}) {
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
        conditions.push(`signal.status IN ('published', 'updated', 'closed')`);
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
               latest_version.snapshot->'disclosures' AS disclosures,
               (SELECT count(DISTINCT processing.subscriber_user_id)::int
                FROM copy_signal_processing_records processing
                JOIN marketplace_provider_profiles provider ON provider.id = signal.provider_id
                WHERE processing.published_signal_id = signal.id
                  AND processing.outcome = 'executed'
                  AND processing.subscriber_user_id <> provider.user_id) AS copy_count
               ${includeTraderExecution ? `,
               (SELECT COALESCE(
                 json_agg(
                   json_build_object(
                     'status', execution.status,
                     'errorMessage', execution.error_message,
                     'exchangeCode', connection.exchange_code,
                     'accountType', account.account_type
                   ) ORDER BY execution.created_at
                 ),
                 '[]'::json
               )
                FROM marketplace_trader_signal_executions execution
                JOIN exchange_connections connection ON connection.id = execution.connection_id
                JOIN exchange_accounts account ON account.id = execution.account_id
                WHERE execution.signal_id = signal.id) AS trader_executions` : ''}
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

    async closeSourceSignalForClosedTrade(client, {
      accountId,
      instrument,
      side,
      closedAt,
      pnlAsset,
    }) {
      const result = await client.query(
        `
        WITH candidate AS (
          SELECT
            signal.id,
            COALESCE((
              SELECT SUM(closed_trade.realized_pnl)
              FROM trading_closed_trades closed_trade
              WHERE closed_trade.account_id = $1
                AND closed_trade.instrument = $2
                AND closed_trade.side = $3
                AND closed_trade.closed_at >= signal.entry_time
                AND closed_trade.closed_at <= $4
            ), 0)::numeric AS realized_pnl
          FROM marketplace_published_signals signal
          WHERE signal.source_account_id = $1
            AND signal.instrument = $2
            AND signal.direction = $3
            AND signal.status IN ('published', 'updated')
            AND (signal.source_order_id IS NOT NULL OR signal.source_position_snapshot_id IS NOT NULL)
            AND signal.entry_time <= $4
            AND NOT EXISTS (
              SELECT 1
              FROM trading_positions position
              WHERE position.account_id = $1
                AND position.instrument = $2
                AND position.side = $3
                AND position.quantity > 0
            )
          ORDER BY signal.created_at DESC
          LIMIT 1
          FOR UPDATE
        )
        UPDATE marketplace_published_signals signal
        SET status = 'closed',
            realized_pnl = candidate.realized_pnl,
            pnl_asset = $5,
            closed_at = $4,
            updated_at = now()
        FROM candidate
        WHERE signal.id = candidate.id
        RETURNING signal.*
        `,
        [accountId, instrument, side, closedAt, pnlAsset || null],
      );
      return result.rows[0] || null;
    },

    async hasActiveSourceSignalForClosedTrade(client, {
      accountId,
      instrument,
      side,
      closedAt,
    }) {
      const result = await client.query(
        `
        SELECT 1
        FROM marketplace_published_signals signal
        WHERE signal.source_account_id = $1
          AND signal.instrument = $2
          AND signal.direction = $3
          AND signal.status IN ('published', 'updated')
          AND (signal.source_order_id IS NOT NULL OR signal.source_position_snapshot_id IS NOT NULL)
          AND signal.entry_time <= $4
        LIMIT 1
        `,
        [accountId, instrument, side, closedAt],
      );
      return result.rowCount > 0;
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

    async findExistingSubscriptionForCheckout(providerId, subscriberUserId) {
      const result = await db.query(
        `
        SELECT * FROM marketplace_subscriptions
        WHERE provider_id = $1 AND subscriber_user_id = $2
          AND status IN ('active', 'trialing', 'past_due')
        LIMIT 1
        `,
        [providerId, subscriberUserId]
      );
      return result.rows[0] || null;
    },

    async findPendingSubscription(providerId, subscriberUserId) {
      const result = await db.query(
        `
        SELECT * FROM marketplace_subscriptions
        WHERE provider_id = $1 AND subscriber_user_id = $2
          AND status = 'subscription_pending'
        LIMIT 1
        `,
        [providerId, subscriberUserId]
      );
      return result.rows[0] || null;
    },

    async findSubscriptionByStripeId(stripeSubscriptionId, client = db) {
      const result = await client.query(
        `SELECT * FROM marketplace_subscriptions WHERE stripe_subscription_id = $1`,
        [stripeSubscriptionId]
      );
      return result.rows[0] || null;
    },

    async findSubscriptionById(subscriptionId, client = db) {
      const result = await client.query(
        `SELECT * FROM marketplace_subscriptions WHERE id = $1`,
        [subscriptionId]
      );
      return result.rows[0] || null;
    },

    async updateMarketplaceSubscription(subscriptionId, fields, client = db) {
      const result = await client.query(
        `
        UPDATE marketplace_subscriptions
        SET status = COALESCE($2, status),
            stripe_checkout_session_id = COALESCE($3, stripe_checkout_session_id),
            stripe_checkout_url = COALESCE($4, stripe_checkout_url),
            stripe_customer_id = COALESCE($5, stripe_customer_id),
            stripe_subscription_id = COALESCE($6, stripe_subscription_id),
            current_period_start = COALESCE($7, current_period_start),
            current_period_end = COALESCE($8, current_period_end),
            cancel_at_period_end = COALESCE($9, cancel_at_period_end),
            canceled_at = COALESCE($10, canceled_at),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          subscriptionId,
          fields.status ?? null,
          fields.checkoutSessionId ?? null,
          fields.checkoutUrl ?? null,
          fields.customerId ?? null,
          fields.stripeSubscriptionId ?? null,
          fields.currentPeriodStart ?? null,
          fields.currentPeriodEnd ?? null,
          fields.cancelAtPeriodEnd ?? null,
          fields.canceledAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertMarketplaceStripeWebhookEvent(client, { eventId, eventType }) {
      const result = await client.query(
        `
        INSERT INTO marketplace_stripe_webhook_events (event_id, event_type)
        VALUES ($1, $2)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
        `,
        [eventId, eventType]
      );
      return result.rows[0] || null;
    },

    async listSubscriptionsForUser(userId) {
      const result = await db.query(
        `
        SELECT s.*, p.handle, p.display_name, plan.name AS plan_name, plan.pricing
        FROM marketplace_subscriptions s
        JOIN marketplace_provider_profiles p ON p.id = s.provider_id
        LEFT JOIN marketplace_provider_plans plan ON plan.id = s.plan_id
        WHERE s.subscriber_user_id = $1
        ORDER BY s.created_at DESC
        `,
        [userId]
      );
      return result.rows;
    },

    async updateSubscriptionStatus(subscriptionId, status, client = db) {
      const result = await client.query(
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
          workspace_id, provider_id, provider_plan_id, created_by, sizing_rule,
          instrument_filters, market_types, execution_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.providerId,
          data.providerPlanId || null,
          data.createdBy,
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
        `
        SELECT config.*, provider.handle AS provider_handle,
               provider.display_name AS provider_name
        FROM copy_configurations config
        JOIN marketplace_provider_profiles provider ON provider.id = config.provider_id
        WHERE config.id = $1
        `,
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
        SELECT c.*, w.id AS workspace_id, c.created_by AS subscriber_user_id
        FROM copy_configurations c
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
        SELECT d.*, c.exchange_code, c.status AS connection_status,
               c.environment, a.account_type, a.status AS account_status
        FROM copy_destination_accounts d
        JOIN exchange_connections c ON c.id = d.connection_id
        JOIN exchange_accounts a ON a.id = d.account_id
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

    async updateCopyProcessingRecord(recordId, fields, client = db) {
      const result = await client.query(
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

    async insertCopyExecutionIntent(client, { processingRecordId, payload, idempotencyKey }) {
      const result = await client.query(
        `
        INSERT INTO copy_execution_intents (processing_record_id, intent_payload, idempotency_key, status)
        VALUES ($1, $2, $3, 'awaiting_confirmation')
        RETURNING *
        `,
        [processingRecordId, JSON.stringify(payload), idempotencyKey]
      );
      return result.rows[0];
    },

    async findCopyRecordForConfirmation(recordId, workspaceId) {
      const result = await db.query(
        `
        SELECT record.*, config.workspace_id, config.status AS config_status,
               intent.id AS copy_intent_id, intent.intent_payload, intent.status AS intent_status
        FROM copy_signal_processing_records record
        JOIN copy_configurations config ON config.id = record.config_id
        LEFT JOIN copy_execution_intents intent ON intent.id = record.execution_intent_id
        WHERE record.id = $1 AND config.workspace_id = $2
        `,
        [recordId, workspaceId]
      );
      return result.rows[0] || null;
    },

    async listCopyRecordsForSignalConfiguration(signalId, configId, workspaceId) {
      const result = await db.query(
        `
        SELECT record.*, config.workspace_id, intent.id AS copy_intent_id,
               intent.intent_payload, intent.status AS intent_status,
               destination.error_message, order_row.rejection_reason
        FROM copy_signal_processing_records record
        JOIN copy_configurations config ON config.id = record.config_id
        LEFT JOIN copy_execution_intents intent ON intent.id = record.execution_intent_id
        LEFT JOIN copy_signal_destination_results destination ON destination.processing_record_id = record.id
        LEFT JOIN trading_orders order_row ON order_row.id = destination.destination_order_id
        WHERE record.published_signal_id = $1
          AND record.config_id = $2
          AND config.workspace_id = $3
        ORDER BY record.processing_timestamp ASC
        `,
        [signalId, configId, workspaceId]
      );
      return result.rows;
    },

    async cancelPendingCopyIntentsForSignal(signalId, configId, client = db) {
      const result = await client.query(
        `
        UPDATE copy_execution_intents intent
        SET status = 'cancelled'
        FROM copy_signal_processing_records record
        WHERE record.execution_intent_id = intent.id
          AND record.published_signal_id = $1
          AND record.config_id = $2
          AND record.outcome = 'held'
          AND intent.status IN ('awaiting_confirmation', 'terminal_confirmation_required')
        RETURNING record.id
        `,
        [signalId, configId],
      );
      const recordIds = result.rows.map((row) => row.id);
      if (recordIds.length > 0) {
        await client.query(
          `
          UPDATE copy_signal_processing_records
          SET outcome = 'skipped', skip_reason = 'manual_copy_overridden'
          WHERE id = ANY($1::uuid[])
          `,
          [recordIds],
        );
        await client.query(
          `
          UPDATE copy_signal_destination_results
          SET outcome = 'skipped', skip_reason = 'manual_copy_overridden',
              error_message = 'Replaced by a manually sized copy request.'
          WHERE processing_record_id = ANY($1::uuid[])
          `,
          [recordIds],
        );
      }
      return recordIds.length;
    },

    async claimCopyExecutionIntent(intentId, expectedStatus) {
      const result = await db.query(
        `
        UPDATE copy_execution_intents
        SET status = 'confirming'
        WHERE id = $1 AND status = $2
        RETURNING *
        `,
        [intentId, expectedStatus]
      );
      return result.rows[0] || null;
    },

    async updateCopyExecutionIntent(intentId, { status, payload }, client = db) {
      const result = await client.query(
        `
        UPDATE copy_execution_intents
        SET status = COALESCE($2, status),
            intent_payload = COALESCE($3, intent_payload)
        WHERE id = $1
        RETURNING *
        `,
        [intentId, status ?? null, payload ? JSON.stringify(payload) : null]
      );
      return result.rows[0] || null;
    },

    async updateCopyDestinationResult(
      processingRecordId,
      { outcome, skipReason, destinationOrderId, errorMessage },
      client = db,
    ) {
      const result = await client.query(
        `
        UPDATE copy_signal_destination_results
        SET outcome = $2,
            skip_reason = $3,
            destination_order_id = $4,
            error_message = COALESCE($5, error_message)
        WHERE processing_record_id = $1
        RETURNING *
        `,
        [
          processingRecordId,
          outcome,
          skipReason ?? null,
          destinationOrderId ?? null,
          errorMessage ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async listCopyProcessingRecordsForWorkspace(workspaceId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT r.*, c.workspace_id, p.handle AS provider_handle,
               p.display_name AS provider_name, signal.instrument, signal.direction,
               intent.status AS intent_status, intent.intent_payload,
               destination.destination_order_id, destination.outcome AS destination_outcome,
               destination.error_message, order_row.rejection_reason
        FROM copy_signal_processing_records r
        JOIN copy_configurations c ON c.id = r.config_id
        JOIN marketplace_provider_profiles p ON p.id = c.provider_id
        JOIN marketplace_published_signals signal ON signal.id = r.published_signal_id
        LEFT JOIN copy_execution_intents intent ON intent.id = r.execution_intent_id
        LEFT JOIN copy_signal_destination_results destination ON destination.processing_record_id = r.id
        LEFT JOIN trading_orders order_row ON order_row.id = destination.destination_order_id
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

    async insertPerformanceObservation(client = db, data) {
      const result = await client.query(
        `
        INSERT INTO marketplace_performance_observations (
          signal_id, observed_at, outcome, evidence, source_closed_trade_id
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (source_closed_trade_id)
          WHERE source_closed_trade_id IS NOT NULL DO NOTHING
        RETURNING *
        `,
        [
          data.signalId,
          data.observedAt,
          data.outcome || null,
          data.evidence ? JSON.stringify(data.evidence) : null,
          data.sourceClosedTradeId || null,
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