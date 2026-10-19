/**
 * SyncExc Server — Connections queries
 */

export function createConnectionsQueries({ db }) {
  return {
    /* =========================================================================
     * EXCHANGE REGISTRY
     * ====================================================================== */

    async listExchanges({ status } = {}) {
      const params = [];
      let where = '';
      if (status) {
        params.push(status);
        where = `WHERE integration_status = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM exchange_registry
        ${where}
        ORDER BY display_name ASC
        `,
        params
      );
      return result.rows;
    },

    async findExchangeByCode(exchangeCode) {
      const result = await db.query(
        `SELECT * FROM exchange_registry WHERE exchange_code = $1`,
        [exchangeCode]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * CONNECTIONS
     * ====================================================================== */

    async insertConnection(client, data) {
      const result = await client.query(
        `
        INSERT INTO exchange_connections (
          workspace_id, owner_id, exchange_code, environment, label, status, capabilities
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.ownerId,
          data.exchangeCode,
          data.environment || 'live',
          data.label,
          data.status || 'pending',
          JSON.stringify(data.capabilities || {}),
        ]
      );
      return result.rows[0];
    },

    async findConnectionById(connectionId) {
      const result = await db.query(
        `SELECT * FROM exchange_connections WHERE id = $1`,
        [connectionId]
      );
      return result.rows[0] || null;
    },

    async listConnectionsForWorkspace(workspaceId, { includeShared = false } = {}) {
      const result = await db.query(
        `
        SELECT * FROM exchange_connections
        WHERE workspace_id = $1 AND status NOT IN ('disconnected', 'revoked')
        ORDER BY created_at DESC
        `,
        [workspaceId]
      );

      if (!includeShared) return result.rows;

      // Add shared connections (grants to this workspace)
      const sharedResult = await db.query(
        `
        SELECT c.*, g.allowed_operations, g.id AS grant_id
        FROM exchange_connections c
        JOIN connection_sharing_grants g ON g.connection_id = c.id
        WHERE g.recipient_workspace_id = $1
          AND g.status = 'active'
          AND (g.expires_at IS NULL OR g.expires_at > now())
          AND g.allowed_operations && ARRAY['view_status', 'view_balances']::text[]
          AND c.status NOT IN ('disconnected', 'revoked')
        `,
        [workspaceId]
      );

      return [
        ...result.rows.map((r) => ({ ...r, is_shared: false })),
        ...sharedResult.rows.map((r) => ({ ...r, is_shared: true })),
      ];
    },

    async listActiveConnectionsForWorkspace(workspaceId) {
      const result = await db.query(
        `
        SELECT * FROM exchange_connections
        WHERE workspace_id = $1 AND status = 'active'
        `,
        [workspaceId]
      );
      return result.rows;
    },

    async updateConnection(id, fields) {
      const result = await db.query(
        `
        UPDATE exchange_connections
        SET label = COALESCE($2, label),
            status = COALESCE($3, status),
            capabilities = COALESCE($4, capabilities),
            metadata = COALESCE($5, metadata),
            last_validated_at = COALESCE($6, last_validated_at),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          fields.label ?? null,
          fields.status ?? null,
          fields.capabilities ? JSON.stringify(fields.capabilities) : null,
          fields.metadata ? JSON.stringify(fields.metadata) : null,
          fields.lastValidatedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async markConnectionDisconnected(connectionId) {
      const result = await db.query(
        `
        UPDATE exchange_connections
        SET status = 'disconnected', disconnected_at = now(), updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [connectionId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * CREDENTIALS
     * ====================================================================== */

    async insertCredential(client, data) {
      const result = await client.query(
        `
        INSERT INTO exchange_credentials (
          connection_id, api_key_encrypted, api_secret_encrypted, passphrase_encrypted, key_version
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.connectionId,
          data.apiKeyEncrypted,
          data.apiSecretEncrypted,
          data.passphraseEncrypted || null,
          data.keyVersion || '1',
        ]
      );
      return result.rows[0];
    },

    async findActiveCredentialForConnection(connectionId) {
      const result = await db.query(
        `
        SELECT * FROM exchange_credentials
        WHERE connection_id = $1 AND revoked_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [connectionId]
      );
      return result.rows[0] || null;
    },

    async markCredentialRevoked(credentialId) {
      await db.query(
        `UPDATE exchange_credentials SET revoked_at = now() WHERE id = $1`,
        [credentialId]
      );
    },

    async insertCredentialRotation(client, data) {
      const result = await client.query(
        `
        INSERT INTO exchange_credential_rotations (
          connection_id, previous_credential_id, new_credential_id, rotated_by, reason
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.connectionId,
          data.previousCredentialId || null,
          data.newCredentialId || null,
          data.rotatedBy || null,
          data.reason || null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * PERMISSIONS
     * ====================================================================== */

    async upsertConnectionPermission(permission) {
      const result = await db.query(
        `
        INSERT INTO exchange_connection_permissions (
          connection_id, permission_key, verification, last_checked_at
        )
        VALUES ($1, $2, $3, now())
        ON CONFLICT (connection_id, permission_key)
        DO UPDATE SET verification = EXCLUDED.verification, last_checked_at = now()
        RETURNING *
        `,
        [permission.connectionId, permission.permissionKey, permission.verification]
      );
      return result.rows[0];
    },

    async listConnectionPermissions(connectionId) {
      const result = await db.query(
        `
        SELECT * FROM exchange_connection_permissions
        WHERE connection_id = $1
        ORDER BY permission_key
        `,
        [connectionId]
      );
      return result.rows;
    },

    /* =========================================================================
     * ACCOUNTS
     * ====================================================================== */

    async insertAccount(client, data) {
      const result = await client.query(
        `
        INSERT INTO exchange_accounts (
          connection_id, exchange_account_id, account_type, status, supported_capabilities, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (connection_id, exchange_account_id, account_type)
        DO UPDATE SET status = EXCLUDED.status,
                      supported_capabilities = EXCLUDED.supported_capabilities,
                      metadata = EXCLUDED.metadata,
                      updated_at = now()
        RETURNING *
        `,
        [
          data.connectionId,
          data.exchangeAccountId || null,
          data.accountType,
          data.status || 'active',
          data.supportedCapabilities || [],
          JSON.stringify(data.metadata || {}),
        ]
      );
      return result.rows[0];
    },

    async findAccountById(accountId) {
      const result = await db.query(
        `SELECT * FROM exchange_accounts WHERE id = $1`,
        [accountId]
      );
      return result.rows[0] || null;
    },

    async listAccountsForConnection(connectionId) {
      const result = await db.query(
        `
        SELECT * FROM exchange_accounts
        WHERE connection_id = $1
        ORDER BY created_at ASC
        `,
        [connectionId]
      );
      return result.rows;
    },

    /* =========================================================================
     * BALANCES
     * ====================================================================== */

    async insertBalanceSnapshot(client, data) {
      const result = await client.query(
        `
        INSERT INTO exchange_balance_snapshots (account_id, observed_at)
        VALUES ($1, $2)
        RETURNING *
        `,
        [data.accountId, data.observedAt || new Date()]
      );
      return result.rows[0];
    },

    async insertBalanceItem(client, data) {
      const result = await client.query(
        `
        INSERT INTO exchange_balance_items (snapshot_id, asset, free, used, total)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [data.snapshotId, data.asset, data.free, data.used, data.total]
      );
      return result.rows[0];
    },

    async getLatestBalanceSnapshot(accountId) {
      const result = await db.query(
        `
        SELECT * FROM exchange_balance_snapshots
        WHERE account_id = $1
        ORDER BY observed_at DESC
        LIMIT 1
        `,
        [accountId]
      );
      return result.rows[0] || null;
    },

    async listBalanceItemsForSnapshot(snapshotId) {
      const result = await db.query(
        `SELECT * FROM exchange_balance_items WHERE snapshot_id = $1 ORDER BY asset ASC`,
        [snapshotId]
      );
      return result.rows;
    },

    /* =========================================================================
     * INSTRUMENTS
     * ====================================================================== */

    async upsertInstrument(client, data) {
      const result = await client.query(
        `
        INSERT INTO exchange_instruments (
          exchange_code, exchange_symbol, normalized_symbol, market_type,
          base_asset, quote_asset, settlement_asset, tick_size, quantity_step,
          minimum_quantity, minimum_notional, contract_multiplier, trading_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (exchange_code, exchange_symbol)
        DO UPDATE SET normalized_symbol = EXCLUDED.normalized_symbol,
                      market_type = EXCLUDED.market_type,
                      base_asset = EXCLUDED.base_asset,
                      quote_asset = EXCLUDED.quote_asset,
                      settlement_asset = EXCLUDED.settlement_asset,
                      tick_size = EXCLUDED.tick_size,
                      quantity_step = EXCLUDED.quantity_step,
                      minimum_quantity = EXCLUDED.minimum_quantity,
                      minimum_notional = EXCLUDED.minimum_notional,
                      contract_multiplier = EXCLUDED.contract_multiplier,
                      trading_status = EXCLUDED.trading_status,
                      updated_at = now()
        RETURNING *
        `,
        [
          data.exchangeCode,
          data.exchangeSymbol,
          data.normalizedSymbol,
          data.marketType,
          data.baseAsset || null,
          data.quoteAsset || null,
          data.settlementAsset || null,
          data.tickSize,
          data.quantityStep,
          data.minimumQuantity || null,
          data.minimumNotional || null,
          data.contractMultiplier || null,
          data.tradingStatus || 'active',
        ]
      );
      return result.rows[0];
    },

    async findInstrument(exchangeCode, exchangeSymbol) {
      const result = await db.query(
        `
        SELECT * FROM exchange_instruments
        WHERE exchange_code = $1 AND exchange_symbol = $2
        LIMIT 1
        `,
        [exchangeCode, exchangeSymbol]
      );
      return result.rows[0] || null;
    },

    async listInstrumentsForExchange(exchangeCode, { marketType } = {}) {
      const params = [exchangeCode];
      let where = `exchange_code = $1`;
      if (marketType) {
        params.push(marketType);
        where += ` AND market_type = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM exchange_instruments
        WHERE ${where} AND trading_status = 'active'
        ORDER BY exchange_symbol ASC
        `,
        params
      );
      return result.rows;
    },

    /* =========================================================================
     * HEALTH
     * ====================================================================== */

    async upsertHealth(health) {
      const result = await db.query(
        `
        INSERT INTO exchange_connection_health (
          connection_id, state, last_successful_request, last_successful_sync,
          last_error, latency_ms, data_freshness
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (connection_id)
        DO UPDATE SET state = EXCLUDED.state,
                      last_successful_request = COALESCE(EXCLUDED.last_successful_request, exchange_connection_health.last_successful_request),
                      last_successful_sync = COALESCE(EXCLUDED.last_successful_sync, exchange_connection_health.last_successful_sync),
                      last_error = EXCLUDED.last_error,
                      latency_ms = EXCLUDED.latency_ms,
                      data_freshness = EXCLUDED.data_freshness,
                      updated_at = now()
        RETURNING *
        `,
        [
          health.connectionId,
          health.state,
          health.lastSuccessfulRequest || null,
          health.lastSuccessfulSync || null,
          health.lastError || null,
          health.latencyMs || null,
          health.dataFreshness || null,
        ]
      );
      return result.rows[0];
    },

    async getHealth(connectionId) {
      const result = await db.query(
        `SELECT * FROM exchange_connection_health WHERE connection_id = $1`,
        [connectionId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * CONNECTION EVENTS
     * ====================================================================== */

    async insertConnectionEvent(data) {
      const result = await db.query(
        `
        INSERT INTO exchange_connection_events (connection_id, event_type, actor_id, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.connectionId,
          data.eventType,
          data.actorId || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * REQUEST METRICS
     * ====================================================================== */

    async insertRequestMetric(metric) {
      await db.query(
        `
        INSERT INTO exchange_request_metrics (
          exchange_code, connection_id, endpoint, method, status_code, latency_ms, error_class
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          metric.exchangeCode,
          metric.connectionId || null,
          metric.endpoint,
          metric.method,
          metric.statusCode || null,
          metric.latencyMs,
          metric.errorClass || null,
        ]
      );
    },

    /* =========================================================================
     * RATE LIMIT STATE
     * ====================================================================== */

    async upsertRateLimitState(state) {
      const result = await db.query(
        `
        INSERT INTO exchange_rate_limit_state (
          exchange_code, window_start, request_count, limit_remaining, reset_at
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (exchange_code)
        DO UPDATE SET window_start = EXCLUDED.window_start,
                      request_count = EXCLUDED.request_count,
                      limit_remaining = EXCLUDED.limit_remaining,
                      reset_at = EXCLUDED.reset_at,
                      updated_at = now()
        RETURNING *
        `,
        [
          state.exchangeCode,
          state.windowStart,
          state.requestCount,
          state.limitRemaining || null,
          state.resetAt || null,
        ]
      );
      return result.rows[0];
    },

    async getRateLimitState(exchangeCode) {
      const result = await db.query(
        `SELECT * FROM exchange_rate_limit_state WHERE exchange_code = $1`,
        [exchangeCode]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * SYNC JOBS
     * ====================================================================== */

    async insertSyncJob(data) {
      const result = await db.query(
        `
        INSERT INTO exchange_sync_jobs (connection_id, job_type, status, started_at)
        VALUES ($1, $2, 'running', now())
        RETURNING *
        `,
        [data.connectionId, data.jobType]
      );
      return result.rows[0];
    },

    async completeSyncJob(id, { status = 'completed', errorMessage = null }) {
      const result = await db.query(
        `
        UPDATE exchange_sync_jobs
        SET status = $2, completed_at = now(), error_message = $3
        WHERE id = $1
        RETURNING *
        `,
        [id, status, errorMessage]
      );
      return result.rows[0] || null;
    },
  };
}

export default createConnectionsQueries;