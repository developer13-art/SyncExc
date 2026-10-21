/**
 * SyncExc Server — Terminal queries
 */

export function createTerminalQueries({ db }) {
  return {
    /* =========================================================================
     * ORDERS
     * ====================================================================== */

    async insertOrder(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_orders (
          workspace_id, connection_id, account_id, exchange_order_id, client_order_id,
          instrument, market_type, side, type, quantity, price, trigger_price,
          time_in_force, reduce_only, status, source, related_execution_id, related_sync_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.connectionId,
          data.accountId,
          data.exchangeOrderId || null,
          data.clientOrderId || null,
          data.instrument,
          data.marketType,
          data.side,
          data.type,
          data.quantity,
          data.price || null,
          data.triggerPrice || null,
          data.timeInForce || null,
          data.reduceOnly || false,
          data.status || 'pending_submission',
          data.source || 'terminal',
          data.relatedExecutionId || null,
          data.relatedSyncId || null,
          JSON.stringify(data.metadata || {}),
        ]
      );
      return result.rows[0];
    },

    async findOrderById(orderId) {
      const result = await db.query(`SELECT * FROM trading_orders WHERE id = $1`, [orderId]);
      return result.rows[0] || null;
    },

    async updateOrder(orderId, fields) {
      const result = await db.query(
        `
        UPDATE trading_orders
        SET exchange_order_id = COALESCE($2, exchange_order_id),
            status = COALESCE($3, status),
            filled_quantity = COALESCE($4, filled_quantity),
            remaining_quantity = COALESCE($5, remaining_quantity),
            average_fill_price = COALESCE($6, average_fill_price),
            rejection_reason = COALESCE($7, rejection_reason),
            metadata = COALESCE($8, metadata),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          orderId,
          fields.exchangeOrderId ?? null,
          fields.status ?? null,
          fields.filledQuantity ?? null,
          fields.remainingQuantity ?? null,
          fields.averageFillPrice ?? null,
          fields.rejectionReason ?? null,
          fields.metadata ? JSON.stringify(fields.metadata) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async listOrders(workspaceId, { statuses = null, accountId = null, limit = 50, cursor = null } = {}) {
      const params = [workspaceId];
      const conditions = ['workspace_id = $1'];

      if (statuses && statuses.length > 0) {
        params.push(statuses);
        conditions.push(`status = ANY($${params.length})`);
      }
      if (accountId) {
        params.push(accountId);
        conditions.push(`account_id = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`created_at < $${params.length}`);
      }
      params.push(limit + 1);

      const result = await db.query(
        `
        SELECT * FROM trading_orders
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
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

    async insertOrderEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_order_events (order_id, event_type, previous_status, new_status, payload)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.orderId,
          data.eventType,
          data.previousStatus || null,
          data.newStatus || null,
          JSON.stringify(data.payload || {}),
        ]
      );
      return result.rows[0];
    },

    async listOrderEvents(orderId) {
      const result = await db.query(
        `SELECT * FROM trading_order_events WHERE order_id = $1 ORDER BY occurred_at ASC`,
        [orderId]
      );
      return result.rows;
    },

    /* =========================================================================
     * FILLS
     * ====================================================================== */

    async insertFill(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_fills (
          order_id, workspace_id, exchange_trade_id, instrument, side,
          quantity, price, fee_amount, fee_asset, executed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (order_id, exchange_trade_id) WHERE exchange_trade_id IS NOT NULL DO NOTHING
        RETURNING *
        `,
        [
          data.orderId,
          data.workspaceId,
          data.exchangeTradeId || null,
          data.instrument,
          data.side,
          data.quantity,
          data.price,
          data.feeAmount || null,
          data.feeAsset || null,
          data.executedAt,
        ]
      );
      return result.rows[0] || null;
    },

    async listFillsForOrder(orderId) {
      const result = await db.query(
        `SELECT * FROM trading_fills WHERE order_id = $1 ORDER BY executed_at ASC`,
        [orderId]
      );
      return result.rows;
    },

    async listTradesForScope(
      workspaceId,
      { limit = 50, cursor = null, accountId = null, instrument = null } = {},
    ) {
      const params = [workspaceId];
      const conditions = ['f.workspace_id = $1'];
      if (accountId) {
        params.push(accountId);
        conditions.push(`o.account_id = $${params.length}`);
      }
      if (instrument) {
        params.push(instrument);
        conditions.push(`f.instrument = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`f.executed_at < $${params.length}`);
      }
      params.push(limit + 1);
      const result = await db.query(
        `
        SELECT f.* FROM trading_fills f
        JOIN trading_orders o ON o.id = f.order_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY f.executed_at DESC
        LIMIT $${params.length}
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.executed_at.toISOString() : null,
      };
    },

    /* =========================================================================
     * POSITIONS
     * ====================================================================== */

    async upsertPosition(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_positions (
          workspace_id, connection_id, account_id, instrument, side, quantity,
          entry_price, mark_price, unrealized_pnl, realized_pnl, margin_mode,
          leverage, liquidation_price, position_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (account_id, instrument, side) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          entry_price = EXCLUDED.entry_price,
          mark_price = EXCLUDED.mark_price,
          unrealized_pnl = EXCLUDED.unrealized_pnl,
          realized_pnl = EXCLUDED.realized_pnl,
          margin_mode = EXCLUDED.margin_mode,
          leverage = EXCLUDED.leverage,
          liquidation_price = EXCLUDED.liquidation_price,
          position_mode = EXCLUDED.position_mode,
          updated_at = now()
        RETURNING *
        `,
        [
          data.workspaceId,
          data.connectionId,
          data.accountId,
          data.instrument,
          data.side,
          data.quantity,
          data.entryPrice,
          data.markPrice || null,
          data.unrealizedPnl || null,
          data.realizedPnl || null,
          data.marginMode || null,
          data.leverage || null,
          data.liquidationPrice || null,
          data.positionMode || null,
        ]
      );
      return result.rows[0];
    },

    async listPositions(workspaceId, { accountId = null, instrument = null } = {}) {
      const params = [workspaceId];
      const conditions = ['workspace_id = $1', 'quantity > 0'];
      if (accountId) {
        params.push(accountId);
        conditions.push(`account_id = $${params.length}`);
      }
      if (instrument) {
        params.push(instrument);
        conditions.push(`instrument = $${params.length}`);
      }
      const result = await db.query(
        `
        SELECT * FROM trading_positions
        WHERE ${conditions.join(' AND ')}
        ORDER BY updated_at DESC
        `,
        params
      );
      return result.rows;
    },

    async insertPositionSnapshot(client, data) {
      await client.query(
        `
        INSERT INTO trading_position_snapshots (
          position_id, quantity, entry_price, mark_price, unrealized_pnl
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [data.positionId, data.quantity, data.entryPrice, data.markPrice, data.unrealizedPnl]
      );
    },

    /* =========================================================================
     * EXECUTION REQUESTS
     * ====================================================================== */

    async insertExecutionRequest(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_execution_requests (
          workspace_id, connection_id, account_id, operation_type, state,
          payload, risk_evaluation_id, idempotency_key, correlation_id, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.connectionId,
          data.accountId,
          data.operationType,
          data.state || 'pending',
          JSON.stringify(data.payload),
          data.riskEvaluationId || null,
          data.idempotencyKey,
          data.correlationId || null,
          data.createdBy || null,
        ]
      );
      return result.rows[0];
    },

    async updateExecutionRequest(id, fields) {
      const result = await db.query(
        `
        UPDATE trading_execution_requests
        SET state = COALESCE($2, state),
            completed_at = COALESCE($3, completed_at),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [id, fields.state ?? null, fields.completedAt ?? null]
      );
      return result.rows[0] || null;
    },

    async claimExecutionRequestForSubmission(id) {
      const result = await db.query(
        `
        UPDATE trading_execution_requests
        SET state = 'submitting', updated_at = now()
        WHERE id = $1 AND state = 'awaiting_confirmation'
        RETURNING *
        `,
        [id]
      );
      return result.rows[0] || null;
    },

    async cancelExecutionRequestIfAwaitingConfirmation(id) {
      const result = await db.query(
        `
        UPDATE trading_execution_requests
        SET state = 'canceled', completed_at = now(), updated_at = now()
        WHERE id = $1 AND state = 'awaiting_confirmation'
        RETURNING *
        `,
        [id]
      );
      return result.rows[0] || null;
    },

    async findExecutionRequestByKey(idempotencyKey) {
      const result = await db.query(
        `SELECT * FROM trading_execution_requests WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      return result.rows[0] || null;
    },

    async findExecutionRequestById(id) {
      const result = await db.query(
        `SELECT * FROM trading_execution_requests WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async insertExecutionAttempt(client, data) {
      const result = await client.query(
        `
        INSERT INTO trading_execution_attempts (
          execution_request_id, attempt_number, request_payload, response_status,
          response_payload, error_message, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.executionRequestId,
          data.attemptNumber,
          JSON.stringify(data.requestPayload),
          data.responseStatus || null,
          data.responsePayload ? JSON.stringify(data.responsePayload) : null,
          data.errorMessage || null,
          data.completedAt || null,
        ]
      );
      return result.rows[0];
    },

    async listExecutionAttempts(executionRequestId) {
      const result = await db.query(
        `
        SELECT * FROM trading_execution_attempts
        WHERE execution_request_id = $1
        ORDER BY attempt_number ASC
        `,
        [executionRequestId]
      );
      return result.rows;
    },

    /* =========================================================================
     * PREFERENCES / SAVED VIEWS
     * ====================================================================== */

    async getPreferences(userId) {
      const result = await db.query(
        `SELECT * FROM terminal_preferences WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    },

    async upsertPreferences(userId, fields) {
      const result = await db.query(
        `
        INSERT INTO terminal_preferences (user_id, display_currency, default_market, layout)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          display_currency = COALESCE($2, terminal_preferences.display_currency),
          default_market = COALESCE($3, terminal_preferences.default_market),
          layout = COALESCE($4, terminal_preferences.layout),
          updated_at = now()
        RETURNING *
        `,
        [
          userId,
          fields.displayCurrency || 'USD',
          fields.defaultMarket || 'spot',
          JSON.stringify(fields.layout || {}),
        ]
      );
      return result.rows[0];
    },

    async listSavedViews(userId, workspaceId = null) {
      const params = [userId];
      let where = `user_id = $1`;
      if (workspaceId) {
        params.push(workspaceId);
        where += ` AND (workspace_id IS NULL OR workspace_id = $2)`;
      }
      const result = await db.query(
        `SELECT * FROM terminal_saved_views WHERE ${where} ORDER BY created_at DESC`,
        params
      );
      return result.rows;
    },

    async insertSavedView(data) {
      const result = await db.query(
        `
        INSERT INTO terminal_saved_views (user_id, workspace_id, name, view_type, config)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [data.userId, data.workspaceId || null, data.name, data.viewType, JSON.stringify(data.config)]
      );
      return result.rows[0];
    },

    async deleteSavedView(id, userId) {
      const result = await db.query(
        `DELETE FROM terminal_saved_views WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, userId]
      );
      return result.rowCount > 0;
    },
  };
}

export default createTerminalQueries;