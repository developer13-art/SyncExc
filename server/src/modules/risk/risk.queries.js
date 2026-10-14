/**
 * SyncExc Server — Risk queries
 */

export function createRiskQueries({ db }) {
  return {
    /* =========================================================================
     * POLICIES
     * ====================================================================== */

    async insertPolicy(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_policies (
          workspace_id, name, scope, scope_ref, enforcement_mode, status, version, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
        RETURNING *
        `,
        [
          data.workspaceId || null,
          data.name,
          data.scope,
          data.scopeRef || null,
          data.enforcementMode,
          data.status || 'active',
          data.createdBy || null,
        ]
      );
      return result.rows[0];
    },

    async insertPolicyVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_policy_versions (policy_id, version, snapshot)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.policyId, data.version, JSON.stringify(data.snapshot)]
      );
      return result.rows[0];
    },

    async insertRuleConfiguration(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_rule_configurations (policy_id, rule_type, config)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.policyId, data.ruleType, JSON.stringify(data.config)]
      );
      return result.rows[0];
    },

    async findPolicyById(policyId) {
      const result = await db.query(
        `SELECT * FROM risk_policies WHERE id = $1`,
        [policyId]
      );
      return result.rows[0] || null;
    },

    async listPoliciesForWorkspace(workspaceId, { status } = {}) {
      const params = [workspaceId];
      let where = `WHERE (workspace_id = $1 OR scope = 'platform')`;
      if (status) {
        params.push(status);
        where += ` AND status = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM risk_policies
        ${where}
        ORDER BY scope ASC, created_at DESC
        `,
        params
      );
      return result.rows;
    },

    async listActiveRulesForPolicy(policyId) {
      const result = await db.query(
        `
        SELECT rc.*, rd.description AS rule_description, rd.config_schema
        FROM risk_rule_configurations rc
        LEFT JOIN risk_rule_definitions rd ON rd.rule_type = rc.rule_type
        WHERE rc.policy_id = $1
        `,
        [policyId]
      );
      return result.rows;
    },

    async listActivePoliciesForScope({ workspaceId, scope, scopeRef }) {
      const params = [workspaceId, scope];
      let scopeRefClause = '';
      if (scopeRef) {
        params.push(scopeRef);
        scopeRefClause = `AND (scope_ref IS NULL OR scope_ref = $${params.length})`;
      }
      const result = await db.query(
        `
        SELECT * FROM risk_policies
        WHERE workspace_id = $1
          AND status = 'active'
          AND scope = $2
          ${scopeRefClause}
        ORDER BY version DESC
        `,
        params
      );
      return result.rows;
    },

    async updatePolicyStatus(policyId, status) {
      const result = await db.query(
        `
        UPDATE risk_policies
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [policyId, status]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * EVALUATIONS
     * ====================================================================== */

    async insertEvaluation(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_evaluations (
          workspace_id, operation_type, operation_payload, outcome,
          reason_code, policy_version, correlation_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.operationType,
          JSON.stringify(data.operationPayload),
          data.outcome,
          data.reasonCode || null,
          data.policyVersion || null,
          data.correlationId || null,
        ]
      );
      return result.rows[0];
    },

    async insertEvaluationResult(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_evaluation_results (
          evaluation_id, rule_type, result, measured_value, limit_value, reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.evaluationId,
          data.ruleType,
          data.result,
          data.measuredValue || null,
          data.limitValue || null,
          data.reason || null,
        ]
      );
      return result.rows[0];
    },

    async findEvaluationById(id) {
      const result = await db.query(
        `SELECT * FROM risk_evaluations WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listEvaluationResults(evaluationId) {
      const result = await db.query(
        `SELECT * FROM risk_evaluation_results WHERE evaluation_id = $1`,
        [evaluationId]
      );
      return result.rows;
    },

    async listEvaluationsForWorkspace(workspaceId, { limit = 50, cursor = null } = {}) {
      const params = [workspaceId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND evaluated_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM risk_evaluations
        WHERE workspace_id = $1 ${cursorClause}
        ORDER BY evaluated_at DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.evaluated_at.toISOString() : null,
      };
    },

    /* =========================================================================
     * RESERVATIONS
     * ====================================================================== */

    async insertReservation(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_reservations (
          workspace_id, scope_key, reservation_type, reserved_value,
          status, operation_ref, expires_at
        )
        VALUES ($1, $2, $3, $4, 'active', $5, $6)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.scopeKey,
          data.reservationType,
          data.reservedValue,
          data.operationRef || null,
          data.expiresAt || null,
        ]
      );
      return result.rows[0];
    },

    async sumActiveReservations(workspaceId, scopeKey, reservationType) {
      const result = await db.query(
        `
        SELECT COALESCE(sum(reserved_value), 0)::text AS total
        FROM risk_reservations
        WHERE workspace_id = $1
          AND scope_key = $2
          AND reservation_type = $3
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
        `,
        [workspaceId, scopeKey, reservationType]
      );
      return result.rows[0]?.total || '0';
    },

    async releaseReservation(reservationId, status = 'released') {
      const result = await db.query(
        `
        UPDATE risk_reservations
        SET status = $2, released_at = now()
        WHERE id = $1 AND status = 'active'
        RETURNING id
        `,
        [reservationId, status]
      );
      return result.rowCount > 0;
    },

    async expireStaleReservations() {
      const result = await db.query(
        `
        UPDATE risk_reservations
        SET status = 'expired', released_at = now()
        WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < now()
        RETURNING id
        `
      );
      return result.rowCount;
    },

    /* =========================================================================
     * EXPOSURE
     * ====================================================================== */

    async insertExposureSnapshot(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_exposure_snapshots (
          workspace_id, scope_type, scope_id, gross_exposure, net_exposure
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.scopeType,
          data.scopeId || null,
          data.grossExposure,
          data.netExposure,
        ]
      );
      return result.rows[0];
    },

    async insertExposureComponent(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_exposure_components (
          snapshot_id, source_type, source_id, instrument, exposure, details
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.snapshotId,
          data.sourceType,
          data.sourceId || null,
          data.instrument || null,
          data.exposure,
          data.details ? JSON.stringify(data.details) : null,
        ]
      );
      return result.rows[0];
    },

    async getLatestExposureSnapshot(workspaceId, scopeType, scopeId = null) {
      const params = [workspaceId, scopeType];
      let scopeClause = '';
      if (scopeId) {
        params.push(scopeId);
        scopeClause = `AND scope_id = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM risk_exposure_snapshots
        WHERE workspace_id = $1 AND scope_type = $2 ${scopeClause}
        ORDER BY observed_at DESC
        LIMIT 1
        `,
        params
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * APPROVALS
     * ====================================================================== */

    async insertApprovalRequest(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_approval_requests (
          workspace_id, evaluation_id, operation_payload, requested_by, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.evaluationId,
          JSON.stringify(data.operationPayload),
          data.requestedBy,
          data.expiresAt,
        ]
      );
      return result.rows[0];
    },

    async findApprovalRequestById(id) {
      const result = await db.query(
        `SELECT * FROM risk_approval_requests WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listPendingApprovalRequests(workspaceId) {
      const result = await db.query(
        `
        SELECT * FROM risk_approval_requests
        WHERE workspace_id = $1 AND status = 'pending' AND expires_at > now()
        ORDER BY created_at ASC
        `,
        [workspaceId]
      );
      return result.rows;
    },

    async insertApprovalDecision(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_approval_decisions (request_id, decision, decided_by, reason)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.requestId, data.decision, data.decidedBy, data.reason || null]
      );
      return result.rows[0];
    },

    async updateApprovalRequestStatus(id, status) {
      const result = await db.query(
        `
        UPDATE risk_approval_requests SET status = $2 WHERE id = $1 RETURNING *
        `,
        [id, status]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * EMERGENCY PAUSE
     * ====================================================================== */

    async insertEmergencyPause(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_emergency_pause_events (
          workspace_id, scope_type, scope_id, status, reason, initiated_by
        )
        VALUES ($1, $2, $3, 'requested', $4, $5)
        RETURNING *
        `,
        [
          data.workspaceId || null,
          data.scopeType,
          data.scopeId || null,
          data.reason,
          data.initiatedBy || null,
        ]
      );
      return result.rows[0];
    },

    async updateEmergencyPauseStatus(id, status, resumedAt = null) {
      const result = await db.query(
        `
        UPDATE risk_emergency_pause_events
        SET status = $2, resumed_at = COALESCE($3, resumed_at)
        WHERE id = $1
        RETURNING *
        `,
        [id, status, resumedAt]
      );
      return result.rows[0] || null;
    },

    async findActivePause({ scopeType, scopeId = null }) {
      const params = [scopeType];
      let scopeClause = '';
      if (scopeId) {
        params.push(scopeId);
        scopeClause = `AND scope_id = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM risk_emergency_pause_events
        WHERE scope_type = $1 ${scopeClause}
          AND status IN ('requested', 'propagating', 'active')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        params
      );
      return result.rows[0] || null;
    },

    async listPauseEvents({ workspaceId, limit = 50, cursor = null } = {}) {
      const params = [workspaceId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND created_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM risk_emergency_pause_events
        WHERE workspace_id = $1 ${cursorClause}
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

    /* =========================================================================
     * CIRCUIT BREAKERS
     * ====================================================================== */

    async upsertCircuitBreaker(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_circuit_breakers (
          workspace_id, scope_type, scope_id, trigger_type, state, config
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING *
        `,
        [
          data.workspaceId || null,
          data.scopeType,
          data.scopeId || null,
          data.triggerType,
          data.state || 'inactive',
          data.config ? JSON.stringify(data.config) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertCircuitBreakerEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_circuit_breaker_events (breaker_id, event_type, reason, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.breakerId,
          data.eventType,
          data.reason || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async listActiveCircuitBreakers(workspaceId) {
      const result = await db.query(
        `
        SELECT * FROM risk_circuit_breakers
        WHERE workspace_id = $1 AND state = 'active'
        `,
        [workspaceId]
      );
      return result.rows;
    },

    /* =========================================================================
     * INCIDENTS
     * ====================================================================== */

    async insertIncident(client, data) {
      const result = await client.query(
        `
        INSERT INTO execution_incidents (
          workspace_id, category, severity, scope_type, scope_id, summary, assigned_to
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.workspaceId || null,
          data.category,
          data.severity,
          data.scopeType || null,
          data.scopeId || null,
          data.summary,
          data.assignedTo || null,
        ]
      );
      return result.rows[0];
    },

    async insertIncidentEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO execution_incident_events (
          incident_id, event_type, actor_id, message, metadata
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.incidentId,
          data.eventType,
          data.actorId || null,
          data.message || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async listIncidents(workspaceId, { status, limit = 50, cursor = null } = {}) {
      const params = [workspaceId, limit + 1];
      const conditions = ['workspace_id = $1'];
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`detected_at < $${params.length}`);
      }
      const result = await db.query(
        `
        SELECT * FROM execution_incidents
        WHERE ${conditions.join(' AND ')}
        ORDER BY detected_at DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.detected_at.toISOString() : null,
      };
    },

    async findIncidentById(id) {
      const result = await db.query(
        `SELECT * FROM execution_incidents WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listIncidentEvents(incidentId) {
      const result = await db.query(
        `SELECT * FROM execution_incident_events WHERE incident_id = $1 ORDER BY occurred_at ASC`,
        [incidentId]
      );
      return result.rows;
    },

    async updateIncidentStatus(incidentId, status, extra = {}) {
      const result = await db.query(
        `
        UPDATE execution_incidents
        SET status = $2,
            resolved_at = COALESCE($3, resolved_at),
            closed_at = COALESCE($4, closed_at),
            root_cause = COALESCE($5, root_cause),
            prevention = COALESCE($6, prevention)
        WHERE id = $1
        RETURNING *
        `,
        [
          incidentId,
          status,
          extra.resolvedAt || null,
          extra.closedAt || null,
          extra.rootCause || null,
          extra.prevention || null,
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * ALERTS
     * ====================================================================== */

    async insertAlert(client, data) {
      const result = await client.query(
        `
        INSERT INTO risk_alerts (
          workspace_id, severity, category, title, message, resource_type, resource_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.workspaceId || null,
          data.severity,
          data.category,
          data.title,
          data.message || null,
          data.resourceType || null,
          data.resourceId || null,
        ]
      );
      return result.rows[0];
    },

    async listAlerts(workspaceId, { state, limit = 50 } = {}) {
      const params = [workspaceId, limit];
      let stateClause = '';
      if (state) {
        params.push(state);
        stateClause = `AND state = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM risk_alerts
        WHERE workspace_id = $1 ${stateClause}
        ORDER BY created_at DESC
        LIMIT $2
        `,
        params
      );
      return result.rows;
    },

    async acknowledgeAlert(alertId, userId) {
      const result = await db.query(
        `
        UPDATE risk_alerts
        SET state = 'acknowledged', acknowledged_by = $2, acknowledged_at = now()
        WHERE id = $1 AND state = 'open'
        RETURNING *
        `,
        [alertId, userId]
      );
      return result.rows[0] || null;
    },

    async resolveAlert(alertId) {
      const result = await db.query(
        `
        UPDATE risk_alerts
        SET state = 'resolved', resolved_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [alertId]
      );
      return result.rows[0] || null;
    },
  };
}

export default createRiskQueries;