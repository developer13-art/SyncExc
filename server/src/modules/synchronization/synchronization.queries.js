/**
 * SyncExc Server — Synchronization queries
 */

export function createSyncQueries({ db }) {
  return {
    /* =========================================================================
     * SYNC GROUPS
     * ====================================================================== */

    async insertGroup(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_groups (
          workspace_id, name, source_connection_id, source_account_id,
          market_types, enabled_event_types, mirroring_mode, execution_mode, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.name,
          data.sourceConnectionId,
          data.sourceAccountId,
          data.marketTypes,
          data.enabledEventTypes,
          data.mirroringMode,
          data.executionMode,
          data.createdBy,
        ]
      );
      return result.rows[0];
    },

    async findGroupById(groupId) {
      const result = await db.query(
        `SELECT * FROM sync_groups WHERE id = $1`,
        [groupId]
      );
      return result.rows[0] || null;
    },

    async listGroupsForWorkspace(workspaceId) {
      const result = await db.query(
        `
        SELECT * FROM sync_groups
        WHERE workspace_id = $1 AND status <> 'archived'
        ORDER BY created_at DESC
        `,
        [workspaceId]
      );
      return result.rows;
    },

    async updateGroupStatus(groupId, status) {
      const result = await db.query(
        `
        UPDATE sync_groups
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [groupId, status]
      );
      return result.rows[0] || null;
    },

    async insertGroupVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_group_versions (group_id, version, snapshot)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.groupId, data.version, JSON.stringify(data.snapshot)]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * DESTINATIONS
     * ====================================================================== */

    async insertDestination(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_group_destinations (
          group_id, connection_id, account_id, sizing_policy_id, risk_policy_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.groupId,
          data.connectionId,
          data.accountId,
          data.sizingPolicyId || null,
          data.riskPolicyId || null,
          'active',
        ]
      );
      return result.rows[0];
    },

    async listDestinationsForGroup(groupId) {
      const result = await db.query(
        `
        SELECT d.*, c.exchange_code, c.label AS connection_label, c.status AS connection_status
        FROM sync_group_destinations d
        JOIN exchange_connections c ON c.id = d.connection_id
        WHERE d.group_id = $1
        ORDER BY d.created_at ASC
        `,
        [groupId]
      );
      return result.rows;
    },

    async findDestinationById(id) {
      const result = await db.query(
        `SELECT * FROM sync_group_destinations WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listActiveDestinationsForGroup(groupId) {
      const result = await db.query(
        `
        SELECT d.*, c.exchange_code, c.status AS connection_status
        FROM sync_group_destinations d
        JOIN exchange_connections c ON c.id = d.connection_id
        WHERE d.group_id = $1 AND d.status = 'active' AND c.status = 'active'
        `,
        [groupId]
      );
      return result.rows;
    },

    async updateDestinationStatus(destinationId, status) {
      const result = await db.query(
        `
        UPDATE sync_group_destinations
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [destinationId, status]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * EVENT SUBSCRIPTIONS
     * ====================================================================== */

    async upsertEventSubscription(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_event_subscriptions (group_id, event_type, filters, enabled)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (group_id, event_type) DO UPDATE SET filters = EXCLUDED.filters, enabled = true
        RETURNING *
        `,
        [data.groupId, data.eventType, data.filters ? JSON.stringify(data.filters) : null]
      );
      return result.rows[0];
    },

    async listSubscriptionsForGroup(groupId) {
      const result = await db.query(
        `
        SELECT * FROM sync_event_subscriptions
        WHERE group_id = $1 AND enabled = true
        `,
        [groupId]
      );
      return result.rows;
    },

    /* =========================================================================
     * SOURCE EVENTS
     * ====================================================================== */

    async insertSourceEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_source_events (
          group_id, source_connection_id, source_account_id, exchange_event_id,
          event_type, instrument, payload, occurred_at, processing_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'received')
        ON CONFLICT (source_connection_id, exchange_event_id) 
          WHERE exchange_event_id IS NOT NULL
          DO NOTHING
        RETURNING *
        `,
        [
          data.groupId || null,
          data.sourceConnectionId,
          data.sourceAccountId,
          data.exchangeEventId || null,
          data.eventType,
          data.instrument,
          JSON.stringify(data.payload),
          data.occurredAt,
        ]
      );
      return result.rows[0] || null;
    },

    async findSourceEventById(id) {
      const result = await db.query(
        `SELECT * FROM sync_source_events WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async updateSourceEventStatus(id, status, processedAt = new Date()) {
      await db.query(
        `
        UPDATE sync_source_events
        SET processing_status = $2, processed_at = $3
        WHERE id = $1
        `,
        [id, status, processedAt]
      );
    },

    /* =========================================================================
     * DEDUPLICATION
     * ====================================================================== */

    async checkDedupKey(client, key) {
      const result = await client.query(
        `SELECT id FROM sync_event_deduplication WHERE dedup_key = $1`,
        [key]
      );
      return result.rows[0] || null;
    },

    async insertDedupKey(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_event_deduplication (dedup_key, source_event_id, scope)
        VALUES ($1, $2, $3)
        ON CONFLICT (dedup_key) DO NOTHING
        RETURNING *
        `,
        [data.dedupKey, data.sourceEventId || null, data.scope]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * OPERATIONS
     * ====================================================================== */

    async insertOperation(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_operations (
          group_id, group_version, source_event_id, source_event_type,
          source_instrument, status, requested_quantity, requested_notional
        )
        VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7)
        RETURNING *
        `,
        [
          data.groupId,
          data.groupVersion,
          data.sourceEventId,
          data.sourceEventType,
          data.sourceInstrument,
          data.requestedQuantity || null,
          data.requestedNotional || null,
        ]
      );
      return result.rows[0];
    },

    async findOperationById(id) {
      const result = await db.query(
        `SELECT * FROM sync_operations WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async updateOperation(id, fields) {
      const result = await db.query(
        `
        UPDATE sync_operations
        SET status = COALESCE($2, status),
            completed_at = COALESCE($3, completed_at)
        WHERE id = $1
        RETURNING *
        `,
        [id, fields.status ?? null, fields.completedAt ?? null]
      );
      return result.rows[0] || null;
    },

    async listOperationsForWorkspace(workspaceId, { limit = 50, cursor = null, groupId = null, status = null } = {}) {
      const params = [workspaceId];
      const conditions = [`g.workspace_id = $1`];
      if (groupId) {
        params.push(groupId);
        conditions.push(`o.group_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`o.status = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`o.created_at < $${params.length}`);
      }
      params.push(limit + 1);

      const result = await db.query(
        `
        SELECT o.* FROM sync_operations o
        JOIN sync_groups g ON g.id = o.group_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY o.created_at DESC
        LIMIT $${params.length}
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
     * DESTINATION OPERATIONS
     * ====================================================================== */

    async insertDestinationOperation(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_destination_operations (
          operation_id, destination_id, account_id, status,
          requested_quantity, requested_notional, idempotency_key, risk_evaluation_id
        )
        VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *
        `,
        [
          data.operationId,
          data.destinationId,
          data.accountId,
          data.requestedQuantity || null,
          data.requestedNotional || null,
          data.idempotencyKey,
          data.riskEvaluationId || null,
        ]
      );
      return result.rows[0] || null;
    },

    async findDestinationOperationById(id) {
      const result = await db.query(
        `SELECT * FROM sync_destination_operations WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listDestinationOperations(operationId) {
      const result = await db.query(
        `
        SELECT d.*, c.exchange_code
        FROM sync_destination_operations d
        JOIN exchange_accounts a ON a.id = d.account_id
        JOIN exchange_connections c ON c.id = a.connection_id
        WHERE d.operation_id = $1
        ORDER BY d.created_at ASC
        `,
        [operationId]
      );
      return result.rows;
    },

    async updateDestinationOperation(id, fields) {
      const result = await db.query(
        `
        UPDATE sync_destination_operations
        SET status = COALESCE($2, status),
            filled_quantity = COALESCE($3, filled_quantity),
            destination_order_id = COALESCE($4, destination_order_id),
            error_code = COALESCE($5, error_code),
            error_message = COALESCE($6, error_message),
            attempts = attempts + COALESCE($7, 0),
            completed_at = COALESCE($8, completed_at),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          fields.status ?? null,
          fields.filledQuantity ?? null,
          fields.destinationOrderId ?? null,
          fields.errorCode ?? null,
          fields.errorMessage ?? null,
          fields.attemptIncrement ?? null,
          fields.completedAt ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertDestinationAttempt(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_operation_attempts (
          destination_operation_id, attempt_number, request_payload,
          response_status, response_payload, error_class, error_message, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.destinationOperationId,
          data.attemptNumber,
          JSON.stringify(data.requestPayload),
          data.responseStatus || null,
          data.responsePayload ? JSON.stringify(data.responsePayload) : null,
          data.errorClass || null,
          data.errorMessage || null,
          data.completedAt || null,
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * INSTRUMENT MAPPINGS
     * ====================================================================== */

    async upsertInstrumentMapping(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_instrument_mappings (
          group_id, source_instrument, destination_id, destination_instrument,
          conversion_factor, validated_at, validation_metadata
        )
        VALUES ($1, $2, $3, $4, $5, now(), $6)
        ON CONFLICT (group_id, destination_id, source_instrument)
        DO UPDATE SET destination_instrument = EXCLUDED.destination_instrument,
                      conversion_factor = EXCLUDED.conversion_factor,
                      validated_at = now(),
                      validation_metadata = EXCLUDED.validation_metadata
        RETURNING *
        `,
        [
          data.groupId,
          data.sourceInstrument,
          data.destinationId,
          data.destinationInstrument,
          data.conversionFactor || null,
          JSON.stringify(data.validationMetadata || {}),
        ]
      );
      return result.rows[0];
    },

    async findInstrumentMapping(groupId, destinationId, sourceInstrument) {
      const result = await db.query(
        `
        SELECT * FROM sync_instrument_mappings
        WHERE group_id = $1 AND destination_id = $2 AND source_instrument = $3
        `,
        [groupId, destinationId, sourceInstrument]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * SIZING POLICIES
     * ====================================================================== */

    async findSizingPolicyById(id) {
      const result = await db.query(
        `SELECT * FROM sync_sizing_policies WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async insertSizingPolicy(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_sizing_policies (group_id, name, policy_type, config)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [data.groupId || null, data.name, data.policyType, JSON.stringify(data.config)]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * RETRY / DEAD LETTER
     * ====================================================================== */

    async insertRetryJob(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_retry_jobs (
          destination_operation_id, attempt_number, scheduled_at, failure_category
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.destinationOperationId,
          data.attemptNumber,
          data.scheduledAt,
          data.failureCategory || null,
        ]
      );
      return result.rows[0];
    },

    async markRetryJobStatus(id, status) {
      await db.query(
        `UPDATE sync_retry_jobs SET status = $2 WHERE id = $1`,
        [id, status]
      );
    },

    async insertDeadLetter(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_dead_letter (
          destination_operation_id, operation_id, reason, payload
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.destinationOperationId || null,
          data.operationId || null,
          data.reason,
          JSON.stringify(data.payload),
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * PAUSE EVENTS
     * ====================================================================== */

    async insertPauseEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO sync_pause_events (group_id, destination_id, scope, action, reason, actor_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.groupId || null,
          data.destinationId || null,
          data.scope,
          data.action,
          data.reason || null,
          data.actorId || null,
        ]
      );
      return result.rows[0];
    },
  };
}

export default createSyncQueries;