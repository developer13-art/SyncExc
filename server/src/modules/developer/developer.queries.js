/**
 * SyncExc Server — Developer queries
 */

export function createDeveloperQueries({ db }) {
  return {
    /* =========================================================================
     * APPLICATIONS
     * ====================================================================== */

    async insertApplication(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_applications (
          workspace_id, owner_id, name, description, type, website, privacy_policy_url, support_contact
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.ownerId,
          data.name,
          data.description || null,
          data.type,
          data.website || null,
          data.privacyPolicyUrl || null,
          data.supportContact || null,
        ]
      );
      return result.rows[0];
    },

    async findApplicationById(applicationId) {
      const result = await db.query(
        `SELECT * FROM developer_applications WHERE id = $1`,
        [applicationId]
      );
      return result.rows[0] || null;
    },

    async listApplicationsForWorkspace(workspaceId, { state } = {}) {
      const params = [workspaceId];
      let stateClause = '';
      if (state) {
        params.push(state);
        stateClause = `AND state = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM developer_applications
        WHERE workspace_id = $1 AND state <> 'archived' ${stateClause}
        ORDER BY created_at DESC
        `,
        params
      );
      return result.rows;
    },

    async updateApplication(applicationId, fields) {
      const result = await db.query(
        `
        UPDATE developer_applications
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            state = COALESCE($4, state),
            website = COALESCE($5, website),
            privacy_policy_url = COALESCE($6, privacy_policy_url),
            support_contact = COALESCE($7, support_contact),
            current_version = current_version + 1,
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          applicationId,
          fields.name ?? null,
          fields.description ?? null,
          fields.state ?? null,
          fields.website ?? null,
          fields.privacyPolicyUrl ?? null,
          fields.supportContact ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertApplicationVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_application_versions (application_id, version, snapshot)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.applicationId, data.version, JSON.stringify(data.snapshot)]
      );
      return result.rows[0];
    },

    async insertRedirectUri(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_application_redirect_uris (application_id, uri)
        VALUES ($1, $2)
        ON CONFLICT (application_id, uri) DO NOTHING
        RETURNING *
        `,
        [data.applicationId, data.uri]
      );
      return result.rows[0] || null;
    },

    async listRedirectUris(applicationId) {
      const result = await db.query(
        `SELECT * FROM developer_application_redirect_uris WHERE application_id = $1`,
        [applicationId]
      );
      return result.rows;
    },

    /* =========================================================================
     * CREDENTIALS
     * ====================================================================== */

    async insertCredential(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_api_credentials (
          application_id, environment, token_hash, token_prefix, scopes, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.applicationId,
          data.environment,
          data.tokenHash,
          data.tokenPrefix,
          data.scopes,
          data.expiresAt || null,
        ]
      );
      return result.rows[0];
    },

    async findCredentialByTokenHash(tokenHash) {
      const result = await db.query(
        `
        SELECT * FROM developer_api_credentials
        WHERE token_hash = $1 AND state = 'active'
        LIMIT 1
        `,
        [tokenHash]
      );
      return result.rows[0] || null;
    },

    async findCredentialById(credentialId) {
      const result = await db.query(
        `SELECT * FROM developer_api_credentials WHERE id = $1`,
        [credentialId]
      );
      return result.rows[0] || null;
    },

    async listCredentialsForApplication(applicationId) {
      const result = await db.query(
        `
        SELECT * FROM developer_api_credentials
        WHERE application_id = $1
        ORDER BY created_at DESC
        `,
        [applicationId]
      );
      return result.rows;
    },

    async updateCredential(credentialId, fields) {
      const result = await db.query(
        `
        UPDATE developer_api_credentials
        SET state = COALESCE($2, state),
            revoked_at = COALESCE($3, revoked_at),
            last_used_at = COALESCE($4, last_used_at)
        WHERE id = $1
        RETURNING *
        `,
        [
          credentialId,
          fields.state ?? null,
          fields.revokedAt ?? null,
          fields.lastUsedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertCredentialVersion(client, data) {
      await client.query(
        `
        INSERT INTO developer_credential_versions (credential_id, version, action, actor_id, metadata)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          data.credentialId,
          data.version,
          data.action,
          data.actorId || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
    },

    /* =========================================================================
     * OAUTH CLIENTS
     * ====================================================================== */

    async insertOauthClient(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_oauth_clients (
          application_id, client_id, client_secret_ref, redirect_uris, grant_types
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.applicationId,
          data.clientId,
          data.clientSecretRef,
          data.redirectUris,
          data.grantTypes || ['authorization_code', 'refresh_token'],
        ]
      );
      return result.rows[0];
    },

    async findOauthClientByClientId(clientId) {
      const result = await db.query(
        `SELECT * FROM developer_oauth_clients WHERE client_id = $1`,
        [clientId]
      );
      return result.rows[0] || null;
    },

    async insertOauthGrant(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_oauth_grants (
          client_id, user_id, workspace_id, scopes, state
        )
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING *
        `,
        [data.clientId, data.userId, data.workspaceId || null, data.scopes]
      );
      return result.rows[0];
    },

    async findOauthGrantById(grantId) {
      const result = await db.query(
        `SELECT * FROM developer_oauth_grants WHERE id = $1`,
        [grantId]
      );
      return result.rows[0] || null;
    },

    async listActiveOauthGrantsForUser(userId) {
      const result = await db.query(
        `
        SELECT g.*, c.application_id, a.name AS application_name
        FROM developer_oauth_grants g
        JOIN developer_oauth_clients c ON c.id = g.client_id
        JOIN developer_applications a ON a.id = c.application_id
        WHERE g.user_id = $1 AND g.state = 'active'
        `,
        [userId]
      );
      return result.rows;
    },

    async revokeOauthGrant(grantId) {
      const result = await db.query(
        `
        UPDATE developer_oauth_grants
        SET state = 'revoked', revoked_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [grantId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * ACCESS TOKENS
     * ====================================================================== */

    async insertAccessToken(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_access_tokens (grant_id, token_hash, scopes, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.grantId, data.tokenHash, data.scopes, data.expiresAt]
      );
      return result.rows[0];
    },

    async findAccessTokenByHash(tokenHash) {
      const result = await db.query(
        `
        SELECT t.*, g.user_id, g.workspace_id, g.state AS grant_state
        FROM developer_access_tokens t
        JOIN developer_oauth_grants g ON g.id = t.grant_id
        WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND t.expires_at > now()
        LIMIT 1
        `,
        [tokenHash]
      );
      return result.rows[0] || null;
    },

    async revokeAccessTokensForGrant(grantId) {
      await db.query(
        `
        UPDATE developer_access_tokens SET revoked_at = now()
        WHERE grant_id = $1 AND revoked_at IS NULL
        `,
        [grantId]
      );
    },

    /* =========================================================================
     * WEBHOOK SUBSCRIPTIONS
     * ====================================================================== */

    async insertWebhookSubscription(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_webhook_subscriptions (
          application_id, workspace_id, destination_url, event_types,
          resource_filters, signing_secret_ref, state
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'active')
        RETURNING *
        `,
        [
          data.applicationId,
          data.workspaceId,
          data.destinationUrl,
          data.eventTypes,
          data.resourceFilters ? JSON.stringify(data.resourceFilters) : null,
          data.signingSecretRef,
        ]
      );
      return result.rows[0];
    },

    async findWebhookSubscriptionById(subscriptionId) {
      const result = await db.query(
        `SELECT * FROM developer_webhook_subscriptions WHERE id = $1`,
        [subscriptionId]
      );
      return result.rows[0] || null;
    },

    async listWebhookSubscriptionsForApplication(applicationId) {
      const result = await db.query(
        `
        SELECT * FROM developer_webhook_subscriptions
        WHERE application_id = $1
        ORDER BY created_at DESC
        `,
        [applicationId]
      );
      return result.rows;
    },

    async listActiveSubscriptionsForEvent(eventType) {
      const result = await db.query(
        `
        SELECT s.*, a.state AS application_state
        FROM developer_webhook_subscriptions s
        JOIN developer_applications a ON a.id = s.application_id
        WHERE s.state = 'active'
          AND $1 = ANY(s.event_types)
          AND a.state = 'active'
        `,
        [eventType]
      );
      return result.rows;
    },

    async updateWebhookSubscription(subscriptionId, fields) {
      const result = await db.query(
        `
        UPDATE developer_webhook_subscriptions
        SET state = COALESCE($2, state),
            event_types = COALESCE($3, event_types),
            resource_filters = COALESCE($4, resource_filters),
            destination_url = COALESCE($5, destination_url),
            consecutive_failures = COALESCE($6, consecutive_failures),
            last_success_at = COALESCE($7, last_success_at),
            last_failure_at = COALESCE($8, last_failure_at),
            suspended_at = COALESCE($9, suspended_at),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          subscriptionId,
          fields.state ?? null,
          fields.eventTypes ?? null,
          fields.resourceFilters ? JSON.stringify(fields.resourceFilters) : null,
          fields.destinationUrl ?? null,
          fields.consecutiveFailures ?? null,
          fields.lastSuccessAt ?? null,
          fields.lastFailureAt ?? null,
          fields.suspendedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertWebhookSecretRef(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_webhook_secret_refs (subscription_id, secret_ref, version)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.subscriptionId, data.secretRef, data.version || 1]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * WEBHOOK EVENTS AND DELIVERIES
     * ====================================================================== */

    async insertWebhookEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_webhook_events (
          event_type, schema_version, payload, resource_type, resource_id
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.eventType,
          data.schemaVersion || 'v1',
          JSON.stringify(data.payload),
          data.resourceType || null,
          data.resourceId || null,
        ]
      );
      return result.rows[0];
    },

    async findWebhookEventById(eventId) {
      const result = await db.query(
        `SELECT * FROM developer_webhook_events WHERE id = $1`,
        [eventId]
      );
      return result.rows[0] || null;
    },

    async insertWebhookDelivery(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_webhook_deliveries (
          subscription_id, event_id, state, next_retry_at
        )
        VALUES ($1, $2, 'pending', $3)
        ON CONFLICT DO NOTHING
        RETURNING *
        `,
        [data.subscriptionId, data.eventId, data.nextRetryAt || new Date()]
      );
      return result.rows[0] || null;
    },

    async findWebhookDeliveryById(deliveryId) {
      const result = await db.query(
        `SELECT * FROM developer_webhook_deliveries WHERE id = $1`,
        [deliveryId]
      );
      return result.rows[0] || null;
    },

    async updateWebhookDelivery(deliveryId, fields) {
      const result = await db.query(
        `
        UPDATE developer_webhook_deliveries
        SET state = COALESCE($2, state),
            attempt_number = COALESCE($3, attempt_number),
            next_retry_at = COALESCE($4, next_retry_at),
            last_response_status = COALESCE($5, last_response_status),
            last_response_snippet = COALESCE($6, last_response_snippet),
            delivered_at = COALESCE($7, delivered_at),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          deliveryId,
          fields.state ?? null,
          fields.attemptNumber ?? null,
          fields.nextRetryAt ?? null,
          fields.lastResponseStatus ?? null,
          fields.lastResponseSnippet ?? null,
          fields.deliveredAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async listPendingDeliveries({ limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM developer_webhook_deliveries
        WHERE state IN ('pending', 'retry_scheduled')
          AND next_retry_at <= now()
        ORDER BY next_retry_at ASC
        LIMIT $1
        `,
        [limit]
      );
      return result.rows;
    },

    async listDeliveriesForSubscription(subscriptionId, { limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT d.*, e.event_type, e.schema_version
        FROM developer_webhook_deliveries d
        JOIN developer_webhook_events e ON e.id = d.event_id
        WHERE d.subscription_id = $1
        ORDER BY d.created_at DESC
        LIMIT $2
        `,
        [subscriptionId, limit]
      );
      return result.rows;
    },

    async insertWebhookDeliveryAttempt(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_webhook_delivery_attempts (
          delivery_id, attempt_number, request_headers, response_status,
          response_body_snippet, duration_ms, error_message, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.deliveryId,
          data.attemptNumber,
          data.requestHeaders ? JSON.stringify(data.requestHeaders) : null,
          data.responseStatus || null,
          data.responseBodySnippet || null,
          data.durationMs || null,
          data.errorMessage || null,
          data.completedAt || null,
        ]
      );
      return result.rows[0];
    },

    async listWebhookDeliveryAttempts(deliveryId) {
      const result = await db.query(
        `
        SELECT * FROM developer_webhook_delivery_attempts
        WHERE delivery_id = $1
        ORDER BY attempt_number ASC
        `,
        [deliveryId]
      );
      return result.rows;
    },

    /* =========================================================================
     * WEBHOOK EVENT SCHEMAS
     * ====================================================================== */

    async findEventSchema(eventType, version = 'v1') {
      const result = await db.query(
        `
        SELECT * FROM developer_webhook_event_schemas
        WHERE event_type = $1 AND version = $2
        `,
        [eventType, version]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * USAGE
     * ====================================================================== */

    async insertApiRequestLog(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_api_request_logs (
          application_id, credential_id, method, path, status, duration_ms, request_id, error_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.applicationId || null,
          data.credentialId || null,
          data.method,
          data.path,
          data.status,
          data.durationMs,
          data.requestId || null,
          data.errorCode || null,
        ]
      );
      return result.rows[0];
    },

    async getUsageSummary({ applicationId, since, until }) {
      const params = [applicationId];
      let range = '';
      if (since) {
        params.push(since);
        range += ` AND created_at >= $${params.length}`;
      }
      if (until) {
        params.push(until);
        range += ` AND created_at <= $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT
          count(*)::int AS total_requests,
          count(*) FILTER (WHERE status < 400)::int AS successful_requests,
          count(*) FILTER (WHERE status >= 400)::int AS error_requests,
          count(*) FILTER (WHERE status = 429)::int AS rate_limited_requests,
          COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms), 0)::int AS p50_latency_ms,
          COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::int AS p95_latency_ms
        FROM developer_api_request_logs
        WHERE application_id = $1 ${range}
        `,
        params
      );
      return result.rows[0];
    },

    async getUsageByEndpoint({ applicationId, since }) {
      const result = await db.query(
        `
        SELECT method, path, count(*)::int AS count, avg(duration_ms)::int AS avg_latency_ms
        FROM developer_api_request_logs
        WHERE application_id = $1 AND created_at >= $2
        GROUP BY method, path
        ORDER BY count DESC
        LIMIT 50
        `,
        [applicationId, since]
      );
      return result.rows;
    },

    async insertUsageEvent(client, data) {
      await client.query(
        `
        INSERT INTO developer_usage_events (application_id, metric, amount)
        VALUES ($1, $2, $3)
        `,
        [data.applicationId, data.metric, data.amount || 1]
      );
    },

    /* =========================================================================
     * RATE LIMITS
     * ====================================================================== */

    async findRateLimitPolicy(scope) {
      const result = await db.query(
        `SELECT * FROM developer_rate_limit_policies WHERE scope = $1`,
        [scope]
      );
      return result.rows[0] || null;
    },

    async insertRateLimitEvent(client, data) {
      await client.query(
        `
        INSERT INTO developer_rate_limit_events (application_id, credential_id, scope)
        VALUES ($1, $2, $3)
        `,
        [data.applicationId, data.credentialId || null, data.scope]
      );
    },

    /* =========================================================================
     * SANDBOX
     * ====================================================================== */

    async insertSandboxSession(client, data) {
      const result = await client.query(
        `
        INSERT INTO developer_sandbox_sessions (application_id, session_ref, expires_at)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.applicationId, data.sessionRef, data.expiresAt]
      );
      return result.rows[0];
    },

    async findSandboxSessionByRef(sessionRef) {
      const result = await db.query(
        `
        SELECT * FROM developer_sandbox_sessions
        WHERE session_ref = $1 AND expires_at > now()
        `,
        [sessionRef]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * AUDIT
     * ====================================================================== */

    async insertAuditEvent(client, data) {
      await client.query(
        `
        INSERT INTO developer_audit_events (
          actor_id, application_id, action, resource_type, resource_id, before, after, outcome
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          data.actorId || null,
          data.applicationId || null,
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

export default createDeveloperQueries;