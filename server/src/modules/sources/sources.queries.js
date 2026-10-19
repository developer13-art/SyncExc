/**
 * SyncExc Server — Sources queries
 */

export function createSourcesQueries({ db }) {
  return {
    async listCategories() {
      const result = await db.query(
        `SELECT id, category_group, code, label FROM source_categories ORDER BY category_group, label`
      );
      return result.rows;
    },

    /* =========================================================================
     * SOURCES
     * ====================================================================== */

    async insertSource(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_sources (
          workspace_id, owner_id, type, name, url, provider_name,
          status, health_state, quality_state
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'draft', 'healthy', 'insufficient_data')
        RETURNING *
        `,
        [
          data.workspaceId,
          data.ownerId,
          data.type,
          data.name,
          data.url || null,
          data.providerName || null,
        ]
      );
      return result.rows[0];
    },

    async findSourceById(sourceId) {
      const result = await db.query(
        `SELECT * FROM signal_sources WHERE id = $1`,
        [sourceId]
      );
      return result.rows[0] || null;
    },

    async listSourcesForWorkspace(workspaceId, { status, type } = {}) {
      const params = [workspaceId];
      const conditions = ['workspace_id = $1'];
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (type) {
        params.push(type);
        conditions.push(`type = $${params.length}`);
      }
      const result = await db.query(
        `
        SELECT * FROM signal_sources
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        `,
        params
      );
      return result.rows;
    },

    async listActiveSourcesForWorkspace(workspaceId) {
      const result = await db.query(
        `
        SELECT * FROM signal_sources
        WHERE workspace_id = $1 AND status = 'active'
        `,
        [workspaceId]
      );
      return result.rows;
    },

    async listSourcesForHealthCheck() {
      const result = await db.query(
        `
        SELECT * FROM signal_sources
        WHERE status = 'active'
        ORDER BY created_at
        `
      );
      return result.rows;
    },

    async updateSource(sourceId, fields) {
      const result = await db.query(
        `
        UPDATE signal_sources
        SET name = COALESCE($2, name),
            url = COALESCE($3, url),
            provider_name = COALESCE($4, provider_name),
            health_state = COALESCE($5, health_state),
            quality_state = COALESCE($6, quality_state),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          sourceId,
          fields.name ?? null,
          fields.url ?? null,
          fields.providerName ?? null,
          fields.healthState ?? null,
          fields.qualityState ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async updateSourceStatus(sourceId, status, archivedAt = null) {
      const result = await db.query(
        `
        UPDATE signal_sources
        SET status = $2,
            archived_at = COALESCE($3, archived_at),
            monitoring_enabled = CASE WHEN $2 IN ('paused', 'archived') THEN false ELSE monitoring_enabled END,
            monitoring_started_at = CASE WHEN $2 IN ('paused', 'archived') THEN NULL ELSE monitoring_started_at END,
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [sourceId, status, archivedAt]
      );
      return result.rows[0] || null;
    },

    async insertSourceVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_versions (source_id, version, snapshot)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.sourceId, data.version, JSON.stringify(data.snapshot)]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * IDENTIFIERS / CATEGORIES
     * ====================================================================== */

    async insertIdentifier(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_identifiers (source_id, identifier_type, value, canonical)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (source_id, identifier_type, value) DO NOTHING
        RETURNING *
        `,
        [data.sourceId, data.identifierType, data.value, data.canonical || false]
      );
      return result.rows[0] || null;
    },

    async assignCategory(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_category_assignments (source_id, category_id, provenance)
        VALUES ($1, $2, $3)
        ON CONFLICT (source_id, category_id) DO NOTHING
        RETURNING *
        `,
        [data.sourceId, data.categoryId, data.provenance || 'user_provided']
      );
      return result.rows[0] || null;
    },

    async findCategoryByCode(categoryGroup, code) {
      const result = await db.query(
        `
        SELECT * FROM source_categories
        WHERE category_group = $1 AND code = $2
        LIMIT 1
        `,
        [categoryGroup, code]
      );
      return result.rows[0] || null;
    },

    async listCategoriesForSource(sourceId) {
      const result = await db.query(
        `
        SELECT sc.*, a.provenance
        FROM signal_source_category_assignments a
        JOIN source_categories sc ON sc.id = a.category_id
        WHERE a.source_id = $1
        `,
        [sourceId]
      );
      return result.rows;
    },

    /* =========================================================================
     * CONNECTIONS
     * ====================================================================== */

    async insertSourceConnection(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_connections (
          source_id, adapter_type, status, authorization_status, metadata
        )
        VALUES ($1, $2, 'pending', $3, $4)
        RETURNING *
        `,
        [
          data.sourceId,
          data.adapterType,
          data.authorizationStatus || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async findSourceConnection(sourceId) {
      const result = await db.query(
        `
        SELECT * FROM signal_source_connections
        WHERE source_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [sourceId]
      );
      return result.rows[0] || null;
    },

    async updateSourceConnection(connectionId, fields, client = db) {
      const result = await client.query(
        `
        UPDATE signal_source_connections
        SET status = COALESCE($2, status),
            authorization_status = COALESCE($3, authorization_status),
            last_validated_at = COALESCE($4, last_validated_at),
            metadata = COALESCE($5, metadata),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          connectionId,
          fields.status ?? null,
          fields.authorizationStatus ?? null,
          fields.lastValidatedAt ?? null,
          fields.metadata ? JSON.stringify(fields.metadata) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertSourceCredential(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_credentials (connection_id, credential_type, encrypted_value, key_version)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.connectionId, data.credentialType, data.encryptedValue, data.keyVersion || '1']
      );
      return result.rows[0];
    },

    async findActiveCredentialForConnection(connectionId) {
      const result = await db.query(
        `
        SELECT * FROM signal_source_credentials
        WHERE connection_id = $1 AND revoked_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [connectionId]
      );
      return result.rows[0] || null;
    },

    async revokeSourceCredentials(client, connectionId) {
      await client.query(
        `UPDATE signal_source_credentials SET revoked_at = now() WHERE connection_id = $1 AND revoked_at IS NULL`,
        [connectionId]
      );
    },

    /* =========================================================================
     * DISCOVERY JOBS
     * ====================================================================== */

    async insertDiscoveryJob(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_discovery_jobs (
          workspace_id, initiated_by, filters, status
        )
        VALUES ($1, $2, $3, 'pending')
        RETURNING *
        `,
        [data.workspaceId, data.initiatedBy || null, JSON.stringify(data.filters)]
      );
      return result.rows[0];
    },

    async findDiscoveryJobById(jobId) {
      const result = await db.query(
        `SELECT * FROM signal_source_discovery_jobs WHERE id = $1`,
        [jobId]
      );
      return result.rows[0] || null;
    },

    async updateDiscoveryJob(jobId, fields) {
      const result = await db.query(
        `
        UPDATE signal_source_discovery_jobs
        SET status = COALESCE($2, status),
            candidates_found = COALESCE($3, candidates_found),
            error_message = COALESCE($4, error_message),
            started_at = COALESCE($5, started_at),
            completed_at = COALESCE($6, completed_at)
        WHERE id = $1
        RETURNING *
        `,
        [
          jobId,
          fields.status ?? null,
          fields.candidatesFound ?? null,
          fields.errorMessage ?? null,
          fields.startedAt ?? null,
          fields.completedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async listDiscoveryJobsForWorkspace(workspaceId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM signal_source_discovery_jobs
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [workspaceId, limit]
      );
      return result.rows;
    },

    /* =========================================================================
     * CANDIDATES
     * ====================================================================== */

    async insertCandidate(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_candidates (
          discovery_job_id, workspace_id, name, url, identifier, type,
          status, confidence_score, evidence, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, $8, $9)
        RETURNING *
        `,
        [
          data.discoveryJobId || null,
          data.workspaceId,
          data.name,
          data.url || null,
          data.identifier || null,
          data.type || null,
          data.confidenceScore || null,
          JSON.stringify(data.evidence || {}),
          JSON.stringify(data.metadata || {}),
        ]
      );
      return result.rows[0];
    },

    async findCandidateById(candidateId) {
      const result = await db.query(
        `SELECT * FROM signal_source_candidates WHERE id = $1`,
        [candidateId]
      );
      return result.rows[0] || null;
    },

    async listCandidatesForWorkspace(workspaceId, { status, limit = 100 } = {}) {
      const params = [workspaceId, limit];
      let statusClause = '';
      if (status) {
        params.push(status);
        statusClause = `AND status = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM signal_source_candidates
        WHERE workspace_id = $1 ${statusClause}
        ORDER BY discovered_at DESC
        LIMIT $2
        `,
        params
      );
      return result.rows;
    },

    async updateCandidateStatus(candidateId, status, reviewedAt = null) {
      const result = await db.query(
        `
        UPDATE signal_source_candidates
        SET status = $2, reviewed_at = COALESCE($3, reviewed_at)
        WHERE id = $1
        RETURNING *
        `,
        [candidateId, status, reviewedAt]
      );
      return result.rows[0] || null;
    },

    async insertCandidateEvidence(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_discovery_evidence (candidate_id, kind, data)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.candidateId, data.kind, JSON.stringify(data.data)]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * REVIEWS
     * ====================================================================== */

    async insertReview(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_reviews (
          source_id, candidate_id, reviewer_id, decision, scope, reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.sourceId || null,
          data.candidateId || null,
          data.reviewerId,
          data.decision,
          data.scope || null,
          data.reason,
        ]
      );
      return result.rows[0];
    },

    async listReviewsForSource(sourceId) {
      const result = await db.query(
        `
        SELECT r.*, u.email AS reviewer_email
        FROM signal_source_reviews r
        LEFT JOIN users u ON u.id = r.reviewer_id
        WHERE r.source_id = $1
        ORDER BY r.created_at DESC
        `,
        [sourceId]
      );
      return result.rows;
    },

    async listReviewsForCandidate(candidateId) {
      const result = await db.query(
        `
        SELECT r.*, u.email AS reviewer_email
        FROM signal_source_reviews r
        LEFT JOIN users u ON u.id = r.reviewer_id
        WHERE r.candidate_id = $1
        ORDER BY r.created_at DESC
        `,
        [candidateId]
      );
      return result.rows;
    },

    /* =========================================================================
     * VALIDATION
     * ====================================================================== */

    async insertValidation(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_validations (
          source_id, overall_result, adapter_version, parser_version, summary, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.sourceId,
          data.overallResult,
          data.adapterVersion || null,
          data.parserVersion || null,
          JSON.stringify(data.summary || {}),
          data.completedAt || new Date(),
        ]
      );
      return result.rows[0];
    },

    async insertValidationCheck(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_validation_checks (validation_id, stage, result, message, evidence)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.validationId,
          data.stage,
          data.result,
          data.message || null,
          data.evidence ? JSON.stringify(data.evidence) : null,
        ]
      );
      return result.rows[0];
    },

    async listValidationsForSource(sourceId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM signal_source_validations
        WHERE source_id = $1
        ORDER BY started_at DESC
        LIMIT $2
        `,
        [sourceId, limit]
      );
      return result.rows;
    },

    /* =========================================================================
     * HEALTH
     * ====================================================================== */

    async insertHealthSnapshot(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_health_snapshots (
          source_id, state, last_event_at, error_count, metadata
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.sourceId,
          data.state,
          data.lastEventAt || null,
          data.errorCount || 0,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async getLatestHealthSnapshot(sourceId) {
      const result = await db.query(
        `
        SELECT * FROM signal_source_health_snapshots
        WHERE source_id = $1
        ORDER BY observed_at DESC
        LIMIT 1
        `,
        [sourceId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * QUALITY
     * ====================================================================== */

    async insertQualitySnapshot(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_quality_snapshots (
          source_id, completeness, parsing_success, freshness_ms, duplicate_rate,
          invalid_rate, sample_count, observation_start, observation_end
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data.sourceId,
          data.completeness || null,
          data.parsingSuccess || null,
          data.freshnessMs || null,
          data.duplicateRate || null,
          data.invalidRate || null,
          data.sampleCount || 0,
          data.observationStart || null,
          data.observationEnd || null,
        ]
      );
      return result.rows[0];
    },

    async getLatestQualitySnapshot(sourceId) {
      const result = await db.query(
        `
        SELECT * FROM signal_source_quality_snapshots
        WHERE source_id = $1
        ORDER BY observed_at DESC
        LIMIT 1
        `,
        [sourceId]
      );
      return result.rows[0] || null;
    },

    async insertObservation(client, data) {
      await client.query(
        `
        INSERT INTO signal_source_observations (
          source_id, event_count, valid_count, invalid_count, duplicate_count
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          data.sourceId,
          data.eventCount || 0,
          data.validCount || 0,
          data.invalidCount || 0,
          data.duplicateCount || 0,
        ]
      );
    },

    /* =========================================================================
     * PARSERS
     * ====================================================================== */

    async insertParser(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_parsers (source_id, name, parser_type)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.sourceId, data.name, data.parserType]
      );
      return result.rows[0];
    },

    async insertParserVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_parser_versions (parser_id, version, config)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.parserId, data.version, JSON.stringify(data.config)]
      );
      return result.rows[0];
    },

    async insertParserTestRun(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_parser_test_runs (
          parser_id, parser_version, sample_input, parsed_output, result, duration_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.parserId,
          data.parserVersion,
          JSON.stringify(data.sampleInput),
          data.parsedOutput ? JSON.stringify(data.parsedOutput) : null,
          data.result,
          data.durationMs || null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * SHARES
     * ====================================================================== */

    async insertShare(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_shares (
          source_id, shared_with_workspace_id, permissions, granted_by
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
        RETURNING *
        `,
        [data.sourceId, data.recipientWorkspaceId, data.permissions, data.grantedBy]
      );
      return result.rows[0] || null;
    },

    async listSharesForSource(sourceId) {
      const result = await db.query(
        `
        SELECT s.*, w.name AS workspace_name
        FROM signal_source_shares s
        JOIN workspaces w ON w.id = s.shared_with_workspace_id
        WHERE s.source_id = $1 AND s.revoked_at IS NULL
        `,
        [sourceId]
      );
      return result.rows;
    },

    async revokeShare(shareId, sourceId) {
      const result = await db.query(
        `
        UPDATE signal_source_shares
        SET revoked_at = now()
        WHERE id = $1 AND source_id = $2 AND revoked_at IS NULL
        RETURNING id
        `,
        [shareId, sourceId]
      );
      return result.rowCount > 0;
    },

    /* =========================================================================
     * INGESTION CURSORS / METRICS
     * ====================================================================== */

    async upsertIngestionCursor(data) {
      const result = await db.query(
        `
        INSERT INTO signal_source_ingestion_cursors (source_id, adapter_type, cursor_value, last_event_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (source_id)
        DO UPDATE SET cursor_value = EXCLUDED.cursor_value,
                      last_event_at = EXCLUDED.last_event_at,
                      updated_at = now()
        RETURNING *
        `,
        [data.sourceId, data.adapterType, data.cursorValue || null, data.lastEventAt || new Date()]
      );
      return result.rows[0];
    },

    async getIngestionCursor(sourceId) {
      const result = await db.query(
        `SELECT * FROM signal_source_ingestion_cursors WHERE source_id = $1`,
        [sourceId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * ALERTS
     * ====================================================================== */

    async insertAlert(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_alerts (source_id, category, severity, message)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.sourceId, data.category, data.severity, data.message || null]
      );
      return result.rows[0];
    },

    async listOpenAlerts(sourceId) {
      const result = await db.query(
        `
        SELECT * FROM signal_source_alerts
        WHERE source_id = $1 AND state = 'open'
        ORDER BY created_at DESC
        `,
        [sourceId]
      );
      return result.rows;
    },

    async resolveAlert(alertId) {
      await db.query(
        `UPDATE signal_source_alerts SET state = 'resolved', resolved_at = now() WHERE id = $1`,
        [alertId]
      );
    },

    /* =========================================================================
     * AUDIT
     * ====================================================================== */

    async insertAuditEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_source_audit_events (
          source_id, actor_id, action, resource_type, resource_id,
          before, after, outcome
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.sourceId || null,
          data.actorId || null,
          data.action,
          data.resourceType,
          data.resourceId || null,
          data.before ? JSON.stringify(data.before) : null,
          data.after ? JSON.stringify(data.after) : null,
          data.outcome || 'success',
        ]
      );
      return result.rows[0];
    },
  };
}

export default createSourcesQueries;