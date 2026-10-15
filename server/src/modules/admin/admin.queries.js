/**
 * SyncExc Server — Admin queries
 */

export function createAdminQueries({ db }) {
  return {
    /* =========================================================================
     * ROLES
     * ====================================================================== */

    async listRoles() {
      const result = await db.query(
        `SELECT * FROM admin_role_definitions ORDER BY name ASC`
      );
      return result.rows;
    },

    async findRoleById(roleId) {
      const result = await db.query(
        `SELECT * FROM admin_role_definitions WHERE id = $1`,
        [roleId]
      );
      return result.rows[0] || null;
    },

    async findRoleByName(name) {
      const result = await db.query(
        `SELECT * FROM admin_role_definitions WHERE name = $1`,
        [name]
      );
      return result.rows[0] || null;
    },

    async insertRole(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_role_definitions (name, description, is_system)
        VALUES ($1, $2, false)
        RETURNING *
        `,
        [data.name, data.description]
      );
      return result.rows[0];
    },

    async listPermissionsForRole(roleId) {
      const result = await db.query(
        `
        SELECT p.* FROM admin_permission_definitions p
        JOIN admin_role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role_id = $1
        ORDER BY p.category, p.permission_key
        `,
        [roleId]
      );
      return result.rows;
    },

    async insertRolePermission(client, data) {
      await client.query(
        `
        INSERT INTO admin_role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [data.roleId, data.permissionId]
      );
    },

    async clearRolePermissions(roleId) {
      await db.query(`DELETE FROM admin_role_permissions WHERE role_id = $1`, [roleId]);
    },

    /* =========================================================================
     * PERMISSIONS
     * ====================================================================== */

    async listPermissions() {
      const result = await db.query(
        `SELECT * FROM admin_permission_definitions ORDER BY category, permission_key`
      );
      return result.rows;
    },

    async findPermissionByKey(key) {
      const result = await db.query(
        `SELECT * FROM admin_permission_definitions WHERE permission_key = $1`,
        [key]
      );
      return result.rows[0] || null;
    },

    async listRoleAssignmentsForUser(userId) {
      const result = await db.query(
        `
        SELECT a.*, r.name AS role_name, r.description AS role_description
        FROM admin_user_role_assignments a
        JOIN admin_role_definitions r ON r.id = a.role_id
        WHERE a.user_id = $1 AND a.revoked_at IS NULL
        `,
        [userId]
      );
      return result.rows;
    },

    async insertRoleAssignment(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_user_role_assignments (user_id, role_id, scope_type, scope_id, assigned_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.userId,
          data.roleId,
          data.scopeType || null,
          data.scopeId || null,
          data.assignedBy || null,
        ]
      );
      return result.rows[0];
    },

    async revokeRoleAssignment(assignmentId, revokedBy) {
      const result = await db.query(
        `
        UPDATE admin_user_role_assignments
        SET revoked_at = now()
        WHERE id = $1 AND revoked_at IS NULL
        RETURNING *
        `,
        [assignmentId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * ACCESS GRANTS
     * ====================================================================== */

    async insertAccessGrant(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_access_grants (
          user_id, resource_type, resource_id, permissions,
          reason, approved_by, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.userId,
          data.resourceType,
          data.resourceId,
          data.permissions,
          data.reason,
          data.approvedBy || null,
          data.expiresAt || null,
        ]
      );
      return result.rows[0];
    },

    async listActiveAccessGrants(userId) {
      const result = await db.query(
        `
        SELECT * FROM admin_access_grants
        WHERE user_id = $1 AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
        `,
        [userId]
      );
      return result.rows;
    },

    async revokeAccessGrant(grantId) {
      const result = await db.query(
        `
        UPDATE admin_access_grants
        SET revoked_at = now()
        WHERE id = $1 AND revoked_at IS NULL
        RETURNING *
        `,
        [grantId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * APPROVALS
     * ====================================================================== */

    async insertApprovalRequest(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_approval_requests (
          action_type, action_payload, requested_by, reason, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.actionType,
          JSON.stringify(data.actionPayload),
          data.requestedBy,
          data.reason || null,
          data.expiresAt || null,
        ]
      );
      return result.rows[0];
    },

    async findApprovalRequest(approvalId) {
      const result = await db.query(
        `SELECT * FROM admin_approval_requests WHERE id = $1`,
        [approvalId]
      );
      return result.rows[0] || null;
    },

    async listPendingApprovals({ limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT a.*, u.email AS requester_email
        FROM admin_approval_requests a
        JOIN users u ON u.id = a.requested_by
        WHERE a.status = 'pending' AND (a.expires_at IS NULL OR a.expires_at > now())
        ORDER BY a.created_at ASC
        LIMIT $1
        `,
        [limit]
      );
      return result.rows;
    },

    async updateApprovalStatus(approvalId, status) {
      const result = await db.query(
        `
        UPDATE admin_approval_requests SET status = $2 WHERE id = $1 RETURNING *
        `,
        [approvalId, status]
      );
      return result.rows[0] || null;
    },

    async insertApprovalDecision(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_approval_decisions (request_id, decision, decided_by, reason)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.requestId, data.decision, data.decidedBy, data.reason || null]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * FEATURE FLAGS
     * ====================================================================== */

    async insertFeatureFlag(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_feature_flags (
          key, description, owning_team, related_module, type,
          default_value, environment, expires_at, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data.key,
          data.description,
          data.owningTeam,
          data.relatedModule,
          data.type,
          data.defaultValue || false,
          data.environment,
          data.expiresAt || null,
          data.createdBy,
        ]
      );
      return result.rows[0];
    },

    async findFeatureFlagByKey(key) {
      const result = await db.query(
        `SELECT * FROM admin_feature_flags WHERE key = $1`,
        [key]
      );
      return result.rows[0] || null;
    },

    async findFeatureFlagById(flagId) {
      const result = await db.query(
        `SELECT * FROM admin_feature_flags WHERE id = $1`,
        [flagId]
      );
      return result.rows[0] || null;
    },

    async listFeatureFlags({ environment } = {}) {
      const params = [];
      let environmentClause = '';
      if (environment) {
        params.push(environment);
        environmentClause = `WHERE environment = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM admin_feature_flags ${environmentClause}
        ORDER BY key ASC
        `,
        params
      );
      return result.rows;
    },

    async updateFeatureFlag(flagId, fields) {
      const result = await db.query(
        `
        UPDATE admin_feature_flags
        SET enabled = COALESCE($2, enabled),
            default_value = COALESCE($3, default_value),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [flagId, fields.enabled ?? null, fields.defaultValue ?? null]
      );
      return result.rows[0] || null;
    },

    async insertFeatureFlagVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_feature_flag_versions (flag_id, version, snapshot, published_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (flag_id, version) DO NOTHING
        RETURNING *
        `,
        [data.flagId, data.version, JSON.stringify(data.snapshot), data.publishedBy || null]
      );
      return result.rows[0] || null;
    },

    async insertFeatureFlagRule(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_feature_flag_rules (flag_id, rule_type, rule_config, priority)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.flagId, data.ruleType, JSON.stringify(data.ruleConfig), data.priority || 100]
      );
      return result.rows[0];
    },

    async listFeatureFlagRules(flagId) {
      const result = await db.query(
        `
        SELECT * FROM admin_feature_flag_rules
        WHERE flag_id = $1
        ORDER BY priority ASC
        `,
        [flagId]
      );
      return result.rows;
    },

    async insertFeatureFlagEvaluation(client, data) {
      await client.query(
        `
        INSERT INTO admin_feature_flag_evaluations (
          flag_key, user_id, workspace_id, result, reason
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          data.flagKey,
          data.userId || null,
          data.workspaceId || null,
          data.result,
          data.reason,
        ]
      );
    },

    async insertRolloutEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_rollout_events (
          flag_id, event_type, previous_state, new_state, actor_id, reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.flagId,
          data.eventType,
          data.previousState ? JSON.stringify(data.previousState) : null,
          data.newState ? JSON.stringify(data.newState) : null,
          data.actorId || null,
          data.reason || null,
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
        INSERT INTO admin_audit_events (
          actor_id, actor_role_ref, workspace_id, action, target_resource,
          target_id, reason, before, after, approval_ref, correlation_id,
          ip_address, user_agent, outcome
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
        `,
        [
          data.actorId || null,
          data.actorRoleRef || null,
          data.workspaceId || null,
          data.action,
          data.targetResource,
          data.targetId,
          data.reason || null,
          data.before ? JSON.stringify(data.before) : null,
          data.after ? JSON.stringify(data.after) : null,
          data.approvalRef || null,
          data.correlationId || null,
          data.ipAddress || null,
          data.userAgent || null,
          data.outcome || 'success',
        ]
      );
      return result.rows[0];
    },

    async searchAuditEvents({ actorId, action, targetResource, targetId, outcome, from, to, limit = 100, cursor = null } = {}) {
      const params = [limit + 1];
      const conditions = [];
      if (actorId) {
        params.push(actorId);
        conditions.push(`actor_id = $${params.length}`);
      }
      if (action) {
        params.push(action);
        conditions.push(`action = $${params.length}`);
      }
      if (targetResource) {
        params.push(targetResource);
        conditions.push(`target_resource = $${params.length}`);
      }
      if (targetId) {
        params.push(targetId);
        conditions.push(`target_id = $${params.length}`);
      }
      if (outcome) {
        params.push(outcome);
        conditions.push(`outcome = $${params.length}`);
      }
      if (from) {
        params.push(from);
        conditions.push(`occurred_at >= $${params.length}`);
      }
      if (to) {
        params.push(to);
        conditions.push(`occurred_at <= $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`occurred_at < $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await db.query(
        `
        SELECT * FROM admin_audit_events
        ${where}
        ORDER BY occurred_at DESC
        LIMIT $1
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.occurred_at.toISOString() : null,
      };
    },

    /* =========================================================================
     * ALERTS
     * ====================================================================== */

    async insertAlertRule(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_alert_rules (
          name, metric_key, threshold, comparison, severity, enabled, created_by
        )
        VALUES ($1, $2, $3, $4, $5, true, $6)
        RETURNING *
        `,
        [
          data.name,
          data.metricKey,
          data.threshold,
          data.comparison,
          data.severity,
          data.createdBy || null,
        ]
      );
      return result.rows[0];
    },

    async listAlertRules({ enabled } = {}) {
      const params = [];
      let where = '';
      if (enabled !== undefined) {
        params.push(enabled);
        where = `WHERE enabled = $1`;
      }
      const result = await db.query(
        `SELECT * FROM admin_alert_rules ${where} ORDER BY name ASC`,
        params
      );
      return result.rows;
    },

    async updateAlertRule(ruleId, fields) {
      const result = await db.query(
        `
        UPDATE admin_alert_rules
        SET name = COALESCE($2, name),
            threshold = COALESCE($3, threshold),
            comparison = COALESCE($4, comparison),
            severity = COALESCE($5, severity),
            enabled = COALESCE($6, enabled),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          ruleId,
          fields.name ?? null,
          fields.threshold ?? null,
          fields.comparison ?? null,
          fields.severity ?? null,
          fields.enabled ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertAlertEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_alert_events (rule_id, severity, message, state)
        VALUES ($1, $2, $3, 'open')
        RETURNING *
        `,
        [data.ruleId || null, data.severity, data.message]
      );
      return result.rows[0];
    },

    async listAlertEvents({ state, limit = 100 } = {}) {
      const params = [limit];
      let stateClause = '';
      if (state) {
        params.push(state);
        stateClause = `WHERE state = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM admin_alert_events
        ${stateClause}
        ORDER BY created_at DESC
        LIMIT $1
        `,
        params
      );
      return result.rows;
    },

    async acknowledgeAlertEvent(eventId, userId) {
      const result = await db.query(
        `
        UPDATE admin_alert_events
        SET state = 'acknowledged', acknowledged_by = $2, acknowledged_at = now()
        WHERE id = $1 AND state = 'open'
        RETURNING *
        `,
        [eventId, userId]
      );
      return result.rows[0] || null;
    },

    async resolveAlertEvent(eventId) {
      const result = await db.query(
        `
        UPDATE admin_alert_events
        SET state = 'resolved', resolved_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [eventId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * OPERATION JOBS
     * ====================================================================== */

    async insertOperationJob(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_operation_jobs (
          job_type, created_by, scope, state, items_total
        )
        VALUES ($1, $2, $3, 'queued', $4)
        RETURNING *
        `,
        [
          data.jobType,
          data.createdBy,
          JSON.stringify(data.scope),
          data.itemsTotal || 0,
        ]
      );
      return result.rows[0];
    },

    async findOperationJob(jobId) {
      const result = await db.query(
        `SELECT * FROM admin_operation_jobs WHERE id = $1`,
        [jobId]
      );
      return result.rows[0] || null;
    },

    async listOperationJobs({ state, limit = 50 } = {}) {
      const params = [limit];
      let stateClause = '';
      if (state) {
        params.push(state);
        stateClause = `WHERE state = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM admin_operation_jobs
        ${stateClause}
        ORDER BY created_at DESC
        LIMIT $1
        `,
        params
      );
      return result.rows;
    },

    async updateOperationJob(jobId, fields) {
      const result = await db.query(
        `
        UPDATE admin_operation_jobs
        SET state = COALESCE($2, state),
            progress = COALESCE($3, progress),
            items_succeeded = COALESCE($4, items_succeeded),
            items_failed = COALESCE($5, items_failed),
            items_skipped = COALESCE($6, items_skipped),
            retry_count = COALESCE($7, retry_count),
            last_error = COALESCE($8, last_error),
            started_at = COALESCE($9, started_at),
            completed_at = COALESCE($10, completed_at)
        WHERE id = $1
        RETURNING *
        `,
        [
          jobId,
          fields.state ?? null,
          fields.progress ?? null,
          fields.itemsSucceeded ?? null,
          fields.itemsFailed ?? null,
          fields.itemsSkipped ?? null,
          fields.retryCount ?? null,
          fields.lastError ?? null,
          fields.startedAt ?? null,
          fields.completedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertOperationJobEvent(client, data) {
      await client.query(
        `
        INSERT INTO admin_operation_job_events (job_id, event_type, payload)
        VALUES ($1, $2, $3)
        `,
        [data.jobId, data.eventType, data.payload ? JSON.stringify(data.payload) : null]
      );
    },

    /* =========================================================================
     * EXPORTS
     * ====================================================================== */

    async insertExport(client, data) {
      const result = await client.query(
        `
        INSERT INTO admin_exports (user_id, resource_type, filters, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING *
        `,
        [data.userId, data.resourceType, data.filters ? JSON.stringify(data.filters) : null]
      );
      return result.rows[0];
    },

    async findExport(exportId) {
      const result = await db.query(
        `SELECT * FROM admin_exports WHERE id = $1`,
        [exportId]
      );
      return result.rows[0] || null;
    },

    async listExports({ userId, limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM admin_exports
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [userId, limit]
      );
      return result.rows;
    },

    async updateExport(exportId, fields) {
      const result = await db.query(
        `
        UPDATE admin_exports
        SET status = COALESCE($2, status),
            storage_key = COALESCE($3, storage_key),
            row_count = COALESCE($4, row_count),
            error_message = COALESCE($5, error_message),
            completed_at = COALESCE($6, completed_at),
            downloaded_at = COALESCE($7, downloaded_at)
        WHERE id = $1
        RETURNING *
        `,
        [
          exportId,
          fields.status ?? null,
          fields.storageKey ?? null,
          fields.rowCount ?? null,
          fields.errorMessage ?? null,
          fields.completedAt ?? null,
          fields.downloadedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * DASHBOARD METRICS
     * ====================================================================== */

    async countUsers({ since } = {}) {
      const params = [];
      let sinceClause = '';
      if (since) {
        params.push(since);
        sinceClause = `AND created_at >= $1`;
      }
      const result = await db.query(
        `SELECT count(*)::int AS count FROM users WHERE deleted_at IS NULL ${sinceClause}`,
        params
      );
      return result.rows[0].count;
    },

    async countActiveSubscriptions() {
      const result = await db.query(
        `SELECT count(*)::int AS count FROM subscriptions WHERE status IN ('active', 'trialing')`
      );
      return result.rows[0].count;
    },

    async subscriptionsByStatus() {
      const result = await db.query(
        `
        SELECT status, count(*)::int AS count
        FROM subscriptions
        GROUP BY status
        `
      );
      return result.rows;
    },

    async paymentMetrics({ since }) {
      const result = await db.query(
        `
        SELECT
          count(*) FILTER (WHERE status = 'succeeded')::int AS successful,
          count(*) FILTER (WHERE status = 'failed')::int AS failed,
          count(*) FILTER (WHERE status = 'pending')::int AS pending,
          COALESCE(sum(amount_minor) FILTER (WHERE status = 'succeeded'), 0)::text AS total_volume_minor
        FROM subscription_payments
        WHERE created_at >= $1
        `,
        [since]
      );
      return result.rows[0];
    },

    async unresolvedRefunds() {
      const result = await db.query(
        `
        SELECT count(*)::int AS count
        FROM refund_records
        WHERE status IN ('requested', 'under_review', 'approved', 'processing')
        `
      );
      return result.rows[0].count;
    },

    async exchangeHealthSummary() {
      const result = await db.query(
        `
        SELECT state, count(*)::int AS count
        FROM exchange_connection_health
        GROUP BY state
        `
      );
      return result.rows;
    },

    async syncBacklog() {
      const result = await db.query(
        `
        SELECT
          count(*) FILTER (WHERE status = 'queued')::int AS queued,
          count(*) FILTER (WHERE status = 'processing')::int AS processing,
          count(*) FILTER (WHERE status = 'reconciliation_required')::int AS reconciliation_required
        FROM sync_operations
        WHERE created_at >= now() - interval '24 hours'
        `
      );
      return result.rows[0];
    },

    async sourceReviewBacklog() {
      const result = await db.query(
        `
        SELECT count(*)::int AS count
        FROM signal_source_candidates
        WHERE status IN ('pending_review', 'under_review')
        `
      );
      return result.rows[0].count;
    },

    async riskAlertsOpen() {
      const result = await db.query(
        `SELECT count(*)::int AS count FROM risk_alerts WHERE state = 'open'`
      );
      return result.rows[0].count;
    },

    async supportBacklog() {
      const result = await db.query(
        `
        SELECT
          count(*) FILTER (WHERE status NOT IN ('resolved', 'closed', 'canceled'))::int AS open,
          count(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('resolved', 'closed', 'canceled'))::int AS urgent
        FROM support_tickets
        `
      );
      return result.rows[0];
    },

    async auditFailuresCount({ since }) {
      const result = await db.query(
        `
        SELECT count(*)::int AS count
        FROM admin_audit_events
        WHERE outcome IN ('failure', 'denied') AND occurred_at >= $1
        `,
        [since]
      );
      return result.rows[0].count;
    },
  };
}

export default createAdminQueries;