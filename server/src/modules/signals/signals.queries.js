/**
 * SyncExc Server — Signals queries
 */

export function createSignalsQueries({ db }) {
  return {
    /* =========================================================================
     * MESSAGES
     * ====================================================================== */

    async insertMessage(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_messages (
          source_id, provider_message_id, channel_ref, provider_timestamp,
          content_type, content, content_hash, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (source_id, provider_message_id) WHERE provider_message_id IS NOT NULL
        DO NOTHING
        RETURNING *
        `,
        [
          data.sourceId,
          data.providerMessageId || null,
          data.channelRef || null,
          data.providerTimestamp,
          data.contentType,
          data.content,
          data.contentHash,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async findMessageById(messageId) {
      const result = await db.query(
        `SELECT * FROM signal_messages WHERE id = $1`,
        [messageId]
      );
      return result.rows[0] || null;
    },

    async updateMessageStatus(messageId, status) {
      await db.query(
        `UPDATE signal_messages SET processing_status = $2 WHERE id = $1`,
        [messageId, status]
      );
    },

    async insertMessageVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_message_versions (message_id, version, content, content_hash, change_reason)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (message_id, version) DO NOTHING
        RETURNING *
        `,
        [data.messageId, data.version, data.content, data.contentHash, data.changeReason || null]
      );
      return result.rows[0] || null;
    },

    async listMessagesForSource(sourceId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM signal_messages
        WHERE source_id = $1
        ORDER BY received_at DESC
        LIMIT $2
        `,
        [sourceId, limit]
      );
      return result.rows;
    },

    async findMessageByHash(sourceId, contentHash) {
      const result = await db.query(
        `
        SELECT * FROM signal_messages
        WHERE source_id = $1 AND content_hash = $2
        ORDER BY received_at DESC
        LIMIT 1
        `,
        [sourceId, contentHash]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * DEDUPLICATION
     * ====================================================================== */

    async findDedupKey(dedupKey) {
      const result = await db.query(
        `SELECT * FROM signal_message_deduplication WHERE dedup_key = $1`,
        [dedupKey]
      );
      return result.rows[0] || null;
    },

    async insertDedupKey(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_message_deduplication (dedup_key, scope, message_id, decision, reason)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (dedup_key) DO NOTHING
        RETURNING *
        `,
        [data.dedupKey, data.scope, data.messageId || null, data.decision, data.reason || null]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * PROCESSING JOBS
     * ====================================================================== */

    async insertProcessingJob(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_processing_jobs (message_id, job_type, status)
        VALUES ($1, $2, 'queued')
        RETURNING *
        `,
        [data.messageId, data.jobType]
      );
      return result.rows[0];
    },

    async updateProcessingJob(jobId, fields) {
      const result = await db.query(
        `
        UPDATE signal_processing_jobs
        SET status = COALESCE($2, status),
            attempts = COALESCE($3, attempts),
            error_message = COALESCE($4, error_message),
            started_at = COALESCE($5, started_at),
            completed_at = COALESCE($6, completed_at)
        WHERE id = $1
        RETURNING *
        `,
        [
          jobId,
          fields.status ?? null,
          fields.attempts ?? null,
          fields.errorMessage ?? null,
          fields.startedAt ?? null,
          fields.completedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * PROCESSING RUNS
     * ====================================================================== */

    async insertProcessingRun(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_processing_runs (
          job_id, parser_version, ai_model, schema_version, output, duration_ms, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.jobId,
          data.parserVersion || null,
          data.aiModel || null,
          data.schemaVersion,
          JSON.stringify(data.output),
          data.durationMs,
          data.errorMessage || null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * PARSERS
     * ====================================================================== */

    async listActiveParsers() {
      const result = await db.query(
        `
        SELECT pd.*, pv.version AS latest_version, pv.config
        FROM signal_parser_definitions pd
        JOIN signal_parser_versions pv ON pv.parser_id = pd.id
        WHERE pv.version = (
          SELECT version FROM signal_parser_versions 
          WHERE parser_id = pd.id ORDER BY version DESC LIMIT 1
        )
        `
      );
      return result.rows;
    },

    /* =========================================================================
     * AI PROCESSING
     * ====================================================================== */

    async insertAiProcessingRecord(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_ai_processing_records (
          processing_run_id, provider, model, prompt_version, response_schema_version,
          tokens_input, tokens_output, raw_response, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data.processingRunId,
          data.provider,
          data.model,
          data.promptVersion,
          data.responseSchemaVersion,
          data.tokensInput || null,
          data.tokensOutput || null,
          data.rawResponse ? JSON.stringify(data.rawResponse) : null,
          data.errorMessage || null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * CANDIDATES
     * ====================================================================== */

    async insertCandidate(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_candidates (
          source_id, message_id, instrument, market_type, direction,
          entry, entry_range, stop_loss, leverage, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          data.sourceId,
          data.messageId,
          data.instrument,
          data.marketType || null,
          data.direction,
          data.entry || null,
          data.entryRange ? JSON.stringify(data.entryRange) : null,
          data.stopLoss || null,
          data.leverage || null,
          data.status || 'processing',
        ]
      );
      return result.rows[0];
    },

    async findCandidateById(candidateId) {
      const result = await db.query(
        `SELECT * FROM trading_signal_candidates WHERE id = $1`,
        [candidateId]
      );
      return result.rows[0] || null;
    },

    async updateCandidate(candidateId, fields) {
      const result = await db.query(
        `
        UPDATE trading_signal_candidates
        SET instrument = COALESCE($2, instrument),
            market_type = COALESCE($3, market_type),
            direction = COALESCE($4, direction),
            entry = COALESCE($5, entry),
            entry_range = COALESCE($6, entry_range),
            stop_loss = COALESCE($7, stop_loss),
            leverage = COALESCE($8, leverage),
            status = COALESCE($9, status),
            eligibility_outcome = COALESCE($10, eligibility_outcome),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          candidateId,
          fields.instrument ?? null,
          fields.marketType ?? null,
          fields.direction ?? null,
          fields.entry ?? null,
          fields.entryRange ? JSON.stringify(fields.entryRange) : null,
          fields.stopLoss ?? null,
          fields.leverage ?? null,
          fields.status ?? null,
          fields.eligibilityOutcome ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertCandidateVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_versions (candidate_id, version, snapshot)
        VALUES ($1, $2, $3)
        ON CONFLICT (candidate_id, version) DO NOTHING
        RETURNING *
        `,
        [data.candidateId, data.version, JSON.stringify(data.snapshot)]
      );
      return result.rows[0] || null;
    },

    async listCandidatesForWorkspace(
      workspaceId,
      { status, sourceId, query, sort = 'desc', limit = 50, cursor = null } = {}
    ) {
      const params = [workspaceId, limit + 1];
      const conditions = ['s.workspace_id = $1'];
      if (sourceId) {
        params.push(sourceId);
        conditions.push(`c.source_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`c.status = $${params.length}`);
      }
      if (query) {
        params.push(`%${query}%`);
        conditions.push(
          `(c.instrument ILIKE $${params.length} OR c.direction ILIKE $${params.length} OR s.name ILIKE $${params.length})`
        );
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`c.created_at ${sort === 'asc' ? '>' : '<'} $${params.length}`);
      }
      const result = await db.query(
        `
        SELECT c.*, s.name AS source_name, execution.status AS execution_status
        FROM trading_signal_candidates c
        JOIN signal_sources s ON s.id = c.source_id
        LEFT JOIN LATERAL (
          SELECT i.status
          FROM trading_execution_intents i
          WHERE i.signal_id = c.id
          ORDER BY i.created_at DESC
          LIMIT 1
        ) execution ON true
        WHERE ${conditions.join(' AND ')}
        ORDER BY c.created_at ${sort === 'asc' ? 'ASC' : 'DESC'}
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

    async findCandidatesByMessageId(messageId) {
      const result = await db.query(
        `SELECT * FROM trading_signal_candidates WHERE message_id = $1`,
        [messageId]
      );
      return result.rows;
    },

    /* =========================================================================
     * SIGNAL FIELDS / TARGETS / ISSUES
     * ====================================================================== */

    async insertSignalField(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_fields (
          candidate_id, field_name, value, provenance, evidence, confidence
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.candidateId,
          data.fieldName,
          JSON.stringify(data.value),
          data.provenance,
          data.evidence ? JSON.stringify(data.evidence) : null,
          data.confidence || null,
        ]
      );
      return result.rows[0];
    },

    async insertSignalTarget(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_targets (candidate_id, ordinal, label, value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (candidate_id, ordinal) DO NOTHING
        RETURNING *
        `,
        [data.candidateId, data.ordinal, data.label || null, data.value]
      );
      return result.rows[0] || null;
    },

    async listTargetsForCandidate(candidateId) {
      const result = await db.query(
        `SELECT * FROM trading_signal_targets WHERE candidate_id = $1 ORDER BY ordinal`,
        [candidateId]
      );
      return result.rows;
    },

    async insertIssue(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_issues (
          candidate_id, issue_type, severity, affected_fields, evidence, detection_method
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.candidateId,
          data.issueType,
          data.severity,
          data.affectedFields || [],
          data.evidence ? JSON.stringify(data.evidence) : null,
          data.detectionMethod,
        ]
      );
      return result.rows[0];
    },

    async listOpenIssues(candidateId) {
      const result = await db.query(
        `
        SELECT * FROM trading_signal_issues
        WHERE candidate_id = $1 AND resolved_at IS NULL
        `,
        [candidateId]
      );
      return result.rows;
    },

    /* =========================================================================
     * SIGNAL RELATIONSHIPS
     * ====================================================================== */

    async insertRelationship(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_relationships (
          candidate_id, related_candidate_id, relationship_type, confidence
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (candidate_id, related_candidate_id, relationship_type) DO NOTHING
        RETURNING *
        `,
        [
          data.candidateId,
          data.relatedCandidateId,
          data.relationshipType,
          data.confidence || null,
        ]
      );
      return result.rows[0] || null;
    },

    async listRelationships(candidateId) {
      const result = await db.query(
        `
        SELECT r.*, c.instrument, c.direction, c.status
        FROM trading_signal_relationships r
        JOIN trading_signal_candidates c ON c.id = r.related_candidate_id
        WHERE r.candidate_id = $1
        `,
        [candidateId]
      );
      return result.rows;
    },

    /* =========================================================================
     * REVIEWS
     * ====================================================================== */

    async insertReview(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_reviews (
          candidate_id, reviewer_id, decision, corrections, reason
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.candidateId,
          data.reviewerId,
          data.decision,
          data.corrections ? JSON.stringify(data.corrections) : null,
          data.reason,
        ]
      );
      return result.rows[0];
    },

    async insertCorrection(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_corrections (
          candidate_id, reviewer_id, field_name, before_value, after_value, reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.candidateId,
          data.reviewerId,
          data.fieldName,
          JSON.stringify(data.beforeValue),
          JSON.stringify(data.afterValue),
          data.reason || null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * VALIDATION
     * ====================================================================== */

    async insertValidation(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_validations (
          candidate_id, rule_set_version, outcome, summary
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.candidateId, data.ruleSetVersion, data.outcome, JSON.stringify(data.summary)]
      );
      return result.rows[0];
    },

    async insertValidationResult(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_validation_results (
          validation_id, check_key, result, severity, message, remediation
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.validationId,
          data.checkKey,
          data.result,
          data.severity || null,
          data.message || null,
          data.remediation || null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * ELIGIBILITY
     * ====================================================================== */

    async insertEligibilityDecision(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_signal_eligibility_decisions (
          candidate_id, outcome, rule_set_version, reasons
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.candidateId, data.outcome, data.ruleSetVersion, JSON.stringify(data.reasons || [])]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * EXECUTION INTENTS
     * ====================================================================== */

    async insertExecutionIntent(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_execution_intents (
          signal_id, signal_version, workspace_id, sync_group_id, operation_type,
          payload, eligibility_decision_id, risk_evaluation_id, idempotency_key,
          correlation_id, status, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *
        `,
        [
          data.signalId,
          data.signalVersion,
          data.workspaceId,
          data.syncGroupId || null,
          data.operationType,
          JSON.stringify(data.payload),
          data.eligibilityDecisionId || null,
          data.riskEvaluationId || null,
          data.idempotencyKey,
          data.correlationId || null,
          data.status || 'created',
          data.expiresAt || null,
        ]
      );
      return result.rows[0] || null;
    },

    async findExecutionIntentById(id) {
      const result = await db.query(
        `SELECT * FROM trading_execution_intents WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listExecutionDestinationResults(intentId) {
      const result = await db.query(
        `
        SELECT r.*, a.account_type, c.exchange_code, c.environment, c.label AS account_label
        FROM trading_execution_destination_results r
        JOIN exchange_accounts a ON a.id = r.account_id
        JOIN exchange_connections c ON c.id = a.connection_id
        WHERE r.intent_id = $1
        ORDER BY r.created_at
        `,
        [intentId]
      );
      return result.rows;
    },

    async updateExecutionIntentStatus(intentId, status, completedAt = null) {
      const result = await db.query(
        `
        UPDATE trading_execution_intents
        SET status = $2, completed_at = COALESCE($3, completed_at)
        WHERE id = $1
        RETURNING *
        `,
        [intentId, status, completedAt]
      );
      return result.rows[0] || null;
    },

    async insertIntentEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_execution_intent_events (intent_id, event_type, actor_id, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.intentId,
          data.eventType,
          data.actorId || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * AUDIT
     * ====================================================================== */

    async insertAuditEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO signal_processing_audit_events (
          actor_id, action, resource_type, resource_id, before, after, outcome
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.actorId || null,
          data.action,
          data.resourceType,
          data.resourceId,
          data.before ? JSON.stringify(data.before) : null,
          data.after ? JSON.stringify(data.after) : null,
          data.outcome || 'success',
        ]
      );
      return result.rows[0];
    },
  };
}

export default createSignalsQueries;