/**
 * SyncExc Server — Automation queries
 */

export function createAutomationQueries({ db }) {
  return {
    /* =========================================================================
     * WORKFLOWS
     * ====================================================================== */

    async insertWorkflow(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_workflows (workspace_id, name, description, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.workspaceId, data.name, data.description || null, data.createdBy]
      );
      return result.rows[0];
    },

    async findWorkflowById(workflowId) {
      const result = await db.query(
        `SELECT * FROM automation_workflows WHERE id = $1`,
        [workflowId]
      );
      return result.rows[0] || null;
    },

    async listWorkflowsForWorkspace(workspaceId, { status } = {}) {
      const params = [workspaceId];
      let statusClause = '';
      if (status) {
        params.push(status);
        statusClause = `AND status = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM automation_workflows
        WHERE workspace_id = $1 AND status <> 'retired' ${statusClause}
        ORDER BY created_at DESC
        `,
        params
      );
      return result.rows;
    },

    async listActiveWorkflowsForWorkspace(workspaceId) {
      const result = await db.query(
        `
        SELECT * FROM automation_workflows
        WHERE workspace_id = $1 AND status = 'active'
        `,
        [workspaceId]
      );
      return result.rows;
    },

    async updateWorkflow(workflowId, fields) {
      const result = await db.query(
        `
        UPDATE automation_workflows
        SET name = COALESCE($2, name),
            description = COALESCE($3, description),
            status = COALESCE($4, status),
            current_version = COALESCE($5, current_version),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          workflowId,
          fields.name ?? null,
          fields.description ?? null,
          fields.status ?? null,
          fields.currentVersion ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * VERSIONS
     * ====================================================================== */

    async insertVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_workflow_versions (
          workflow_id, version, definition, is_published, published_at, published_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (workflow_id, version) DO NOTHING
        RETURNING *
        `,
        [
          data.workflowId,
          data.version,
          JSON.stringify(data.definition),
          data.isPublished || false,
          data.publishedAt || null,
          data.publishedBy || null,
        ]
      );
      return result.rows[0] || null;
    },

    async findVersionById(versionId) {
      const result = await db.query(
        `SELECT * FROM automation_workflow_versions WHERE id = $1`,
        [versionId]
      );
      return result.rows[0] || null;
    },

    async findPublishedVersion(workflowId) {
      const result = await db.query(
        `
        SELECT * FROM automation_workflow_versions
        WHERE workflow_id = $1 AND is_published = true
        ORDER BY version DESC
        LIMIT 1
        `,
        [workflowId]
      );
      return result.rows[0] || null;
    },

    async findLatestVersion(workflowId) {
      const result = await db.query(
        `
        SELECT * FROM automation_workflow_versions
        WHERE workflow_id = $1
        ORDER BY version DESC
        LIMIT 1
        `,
        [workflowId]
      );
      return result.rows[0] || null;
    },

    async listVersions(workflowId) {
      const result = await db.query(
        `
        SELECT * FROM automation_workflow_versions
        WHERE workflow_id = $1
        ORDER BY version DESC
        `,
        [workflowId]
      );
      return result.rows;
    },

    async markVersionPublished(versionId, userId) {
      const result = await db.query(
        `
        UPDATE automation_workflow_versions
        SET is_published = true, published_at = now(), published_by = $2
        WHERE id = $1
        RETURNING *
        `,
        [versionId, userId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * NODES AND EDGES
     * ====================================================================== */

    async insertNode(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_workflow_nodes (
          version_id, node_id, node_type, category, config, position
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (version_id, node_id) DO NOTHING
        RETURNING *
        `,
        [
          data.versionId,
          data.nodeId,
          data.nodeType,
          data.category,
          JSON.stringify(data.config || {}),
          data.position ? JSON.stringify(data.position) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertEdge(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_workflow_edges (
          version_id, edge_id, source_node_id, source_port, target_node_id, target_port
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (version_id, edge_id) DO NOTHING
        RETURNING *
        `,
        [
          data.versionId,
          data.edgeId,
          data.sourceNodeId,
          data.sourcePort || null,
          data.targetNodeId,
          data.targetPort || null,
        ]
      );
      return result.rows[0] || null;
    },

    async listNodesForVersion(versionId) {
      const result = await db.query(
        `SELECT * FROM automation_workflow_nodes WHERE version_id = $1`,
        [versionId]
      );
      return result.rows;
    },

    async listEdgesForVersion(versionId) {
      const result = await db.query(
        `SELECT * FROM automation_workflow_edges WHERE version_id = $1`,
        [versionId]
      );
      return result.rows;
    },

    /* =========================================================================
     * TRIGGERS
     * ====================================================================== */

    async insertTrigger(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_triggers (
          workflow_id, version_id, trigger_type, config, enabled
        )
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
        `,
        [data.workflowId, data.versionId, data.triggerType, JSON.stringify(data.config || {})]
      );
      return result.rows[0];
    },

    async listTriggersForWorkflow(workflowId) {
      const result = await db.query(
        `SELECT * FROM automation_triggers WHERE workflow_id = $1 AND enabled = true`,
        [workflowId]
      );
      return result.rows;
    },

    async findTriggersByType(triggerType) {
      const result = await db.query(
        `
        SELECT t.*, w.workspace_id, w.status AS workflow_status, w.current_version
        FROM automation_triggers t
        JOIN automation_workflows w ON w.id = t.workflow_id
        WHERE t.trigger_type = $1 AND t.enabled = true AND w.status = 'active'
        `,
        [triggerType]
      );
      return result.rows;
    },

    async updateTrigger(triggerId, fields) {
      const result = await db.query(
        `
        UPDATE automation_triggers
        SET config = COALESCE($2, config),
            enabled = COALESCE($3, enabled),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          triggerId,
          fields.config ? JSON.stringify(fields.config) : null,
          fields.enabled ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * SCHEDULES
     * ====================================================================== */

    async insertSchedule(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_schedules (
          workflow_id, version_id, schedule_type, cron_expression, timezone, next_run_at, enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
        `,
        [
          data.workflowId,
          data.versionId,
          data.scheduleType,
          data.cronExpression || null,
          data.timezone || 'UTC',
          data.nextRunAt,
        ]
      );
      return result.rows[0];
    },

    async listSchedulesForWorkflow(workflowId) {
      const result = await db.query(
        `SELECT * FROM automation_schedules WHERE workflow_id = $1`,
        [workflowId]
      );
      return result.rows;
    },

    async listDueSchedules(limit = 100) {
      const result = await db.query(
        `
        SELECT * FROM automation_schedules
        WHERE enabled = true AND next_run_at <= now()
        ORDER BY next_run_at ASC
        LIMIT $1
        `,
        [limit]
      );
      return result.rows;
    },

    async updateSchedule(scheduleId, fields) {
      const result = await db.query(
        `
        UPDATE automation_schedules
        SET next_run_at = COALESCE($2, next_run_at),
            last_run_at = COALESCE($3, last_run_at),
            enabled = COALESCE($4, enabled),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          scheduleId,
          fields.nextRunAt ?? null,
          fields.lastRunAt ?? null,
          fields.enabled ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * RUNS
     * ====================================================================== */

    async insertRun(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_workflow_runs (
          workflow_id, version_id, version, trigger_event_id, state, correlation_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.workflowId,
          data.versionId,
          data.version,
          data.triggerEventId || null,
          data.state || 'queued',
          data.correlationId || null,
        ]
      );
      return result.rows[0];
    },

    async findRunById(runId) {
      const result = await db.query(
        `SELECT * FROM automation_workflow_runs WHERE id = $1`,
        [runId]
      );
      return result.rows[0] || null;
    },

    async updateRun(runId, fields) {
      const result = await db.query(
        `
        UPDATE automation_workflow_runs
        SET state = COALESCE($2, state),
            completed_at = COALESCE($3, completed_at),
            error_message = COALESCE($4, error_message)
        WHERE id = $1
        RETURNING *
        `,
        [runId, fields.state ?? null, fields.completedAt ?? null, fields.errorMessage ?? null]
      );
      return result.rows[0] || null;
    },

    async listRunsForWorkflow(workflowId, { limit = 50, cursor = null, state = null } = {}) {
      const params = [workflowId, limit + 1];
      const conditions = ['workflow_id = $1'];
      if (state) {
        params.push(state);
        conditions.push(`state = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`started_at < $${params.length}`);
      }
      const result = await db.query(
        `
        SELECT * FROM automation_workflow_runs
        WHERE ${conditions.join(' AND ')}
        ORDER BY started_at DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.started_at.toISOString() : null,
      };
    },

    /* =========================================================================
     * RUN STEPS
     * ====================================================================== */

    async insertRunStep(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_workflow_run_steps (
          run_id, node_id, node_type, step_index, state, input, output, error_message, duration_ms, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          data.runId,
          data.nodeId,
          data.nodeType,
          data.stepIndex,
          data.state,
          data.input ? JSON.stringify(data.input) : null,
          data.output ? JSON.stringify(data.output) : null,
          data.errorMessage || null,
          data.durationMs || null,
          data.completedAt || null,
        ]
      );
      return result.rows[0];
    },

    async listRunSteps(runId) {
      const result = await db.query(
        `SELECT * FROM automation_workflow_run_steps WHERE run_id = $1 ORDER BY step_index ASC`,
        [runId]
      );
      return result.rows;
    },

    /* =========================================================================
     * ACTION ATTEMPTS
     * ====================================================================== */

    async insertActionAttempt(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_action_attempts (
          run_step_id, attempt_number, request_payload, response_payload,
          error_class, error_message, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.runStepId,
          data.attemptNumber,
          data.requestPayload ? JSON.stringify(data.requestPayload) : null,
          data.responsePayload ? JSON.stringify(data.responsePayload) : null,
          data.errorClass || null,
          data.errorMessage || null,
          data.completedAt || null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * TEMPLATES
     * ====================================================================== */

    async insertTemplate(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_templates (name, description, definition, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.name, data.description || null, JSON.stringify(data.definition), data.createdBy || null]
      );
      return result.rows[0];
    },

    async listTemplates() {
      const result = await db.query(
        `SELECT * FROM automation_templates WHERE status = 'active' ORDER BY created_at DESC`
      );
      return result.rows;
    },

    async findTemplateById(templateId) {
      const result = await db.query(
        `SELECT * FROM automation_templates WHERE id = $1`,
        [templateId]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * TEST RUNS
     * ====================================================================== */

    async insertTestRun(client, data) {
      const result = await client.query(
        `
        INSERT INTO automation_test_runs (
          workflow_id, version_id, input_sample, result, steps_executed,
          validation_errors, duration_ms, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.workflowId,
          data.versionId,
          JSON.stringify(data.inputSample || {}),
          data.result,
          JSON.stringify(data.stepsExecuted || []),
          data.validationErrors ? JSON.stringify(data.validationErrors) : null,
          data.durationMs || null,
          data.createdBy || null,
        ]
      );
      return result.rows[0];
    },

    async listTestRuns(workflowId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM automation_test_runs
        WHERE workflow_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [workflowId, limit]
      );
      return result.rows;
    },

    /* =========================================================================
     * USAGE
     * ====================================================================== */

    async insertUsageEvent(client, data) {
      await client.query(
        `
        INSERT INTO automation_usage_events (
          workspace_id, workflow_id, run_id, event_type, quantity
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          data.workspaceId,
          data.workflowId || null,
          data.runId || null,
          data.eventType,
          data.quantity || 1,
        ]
      );
    },

    /* =========================================================================
     * AUDIT
     * ====================================================================== */

    async insertAuditEvent(client, data) {
      await client.query(
        `
        INSERT INTO automation_audit_events (
          workspace_id, actor_id, action, resource_type, resource_id, before, after, outcome
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          data.workspaceId || null,
          data.actorId || null,
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

export default createAutomationQueries;