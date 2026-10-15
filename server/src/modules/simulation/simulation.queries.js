/**
 * SyncExc Server — Simulation queries
 */

export function createSimulationQueries({ db }) {
  return {
    /* =========================================================================
     * ENVIRONMENTS
     * ====================================================================== */

    async insertEnvironment(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_environments (
          workspace_id, name, type, settings, created_by
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.name,
          data.type,
          JSON.stringify(data.settings || {}),
          data.createdBy || null,
        ]
      );
      return result.rows[0];
    },

    async findEnvironmentById(envId) {
      const result = await db.query(
        `SELECT * FROM simulation_environments WHERE id = $1`,
        [envId]
      );
      return result.rows[0] || null;
    },

    async listEnvironmentsForWorkspace(workspaceId, { type } = {}) {
      const params = [workspaceId];
      let typeClause = '';
      if (type) {
        params.push(type);
        typeClause = `AND type = $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM simulation_environments
        WHERE workspace_id = $1 AND state <> 'archived' ${typeClause}
        ORDER BY created_at DESC
        `,
        params
      );
      return result.rows;
    },

    async updateEnvironment(envId, fields) {
      const result = await db.query(
        `
        UPDATE simulation_environments
        SET name = COALESCE($2, name),
            state = COALESCE($3, state),
            settings = COALESCE($4, settings),
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          envId,
          fields.name ?? null,
          fields.state ?? null,
          fields.settings ? JSON.stringify(fields.settings) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async insertEnvironmentVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_environment_versions (environment_id, version, config)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.environmentId, data.version, JSON.stringify(data.config)]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * ACCOUNTS
     * ====================================================================== */

    async insertAccount(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_accounts (environment_id, label, exchange_code, account_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          data.environmentId,
          data.label,
          data.exchangeCode || null,
          data.accountType || 'spot',
        ]
      );
      return result.rows[0];
    },

    async findAccountById(accountId) {
      const result = await db.query(
        `SELECT * FROM simulation_accounts WHERE id = $1`,
        [accountId]
      );
      return result.rows[0] || null;
    },

    async listAccountsForEnvironment(envId) {
      const result = await db.query(
        `SELECT * FROM simulation_accounts WHERE environment_id = $1 ORDER BY created_at`,
        [envId]
      );
      return result.rows;
    },

    /* =========================================================================
     * BALANCES
     * ====================================================================== */

    async upsertBalance(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_account_balances (account_id, asset, free, used, total)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (account_id, asset) DO UPDATE SET
          free = EXCLUDED.free,
          used = EXCLUDED.used,
          total = EXCLUDED.total,
          updated_at = now()
        RETURNING *
        `,
        [data.accountId, data.asset, data.free, data.used, data.total]
      );
      return result.rows[0];
    },

    async getBalance(accountId, asset) {
      const result = await db.query(
        `
        SELECT * FROM simulation_account_balances
        WHERE account_id = $1 AND asset = $2
        `,
        [accountId, asset]
      );
      return result.rows[0] || null;
    },

    async listBalances(accountId) {
      const result = await db.query(
        `
        SELECT * FROM simulation_account_balances
        WHERE account_id = $1
        ORDER BY asset ASC
        `,
        [accountId]
      );
      return result.rows;
    },

    /* =========================================================================
     * LEDGER
     * ====================================================================== */

    async insertLedgerEntry(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_ledger_entries (
          account_id, asset, amount, entry_type, source_type, source_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.accountId,
          data.asset,
          data.amount,
          data.entryType,
          data.sourceType || null,
          data.sourceId || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async listLedgerEntries(accountId, { limit = 100 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM simulation_ledger_entries
        WHERE account_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [accountId, limit]
      );
      return result.rows;
    },

    /* =========================================================================
     * DATASETS
     * ====================================================================== */

    async insertDataset(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_datasets (
          name, description, source, instrument, market_type, coverage_start, coverage_end, manifest
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.name,
          data.description || null,
          data.source,
          data.instrument || null,
          data.marketType || null,
          data.coverageStart || null,
          data.coverageEnd || null,
          data.manifest ? JSON.stringify(data.manifest) : null,
        ]
      );
      return result.rows[0];
    },

    async findDatasetById(datasetId) {
      const result = await db.query(
        `SELECT * FROM simulation_datasets WHERE id = $1`,
        [datasetId]
      );
      return result.rows[0] || null;
    },

    async insertDatasetVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_dataset_versions (dataset_id, version, manifest, checksum)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (dataset_id, version) DO NOTHING
        RETURNING *
        `,
        [data.datasetId, data.version, JSON.stringify(data.manifest), data.checksum]
      );
      return result.rows[0] || null;
    },

    async findDatasetVersion(datasetVersionId) {
      const result = await db.query(
        `SELECT * FROM simulation_dataset_versions WHERE id = $1`,
        [datasetVersionId]
      );
      return result.rows[0] || null;
    },

    async insertMarketEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_market_events (dataset_version_id, event_type, instrument, payload, occurred_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.datasetVersionId,
          data.eventType,
          data.instrument,
          JSON.stringify(data.payload),
          data.occurredAt,
        ]
      );
      return result.rows[0];
    },

    async insertMarketEventsBulk(client, rows) {
      if (rows.length === 0) return 0;
      const values = [];
      const params = [];
      let idx = 1;
      for (const row of rows) {
        values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        params.push(
          row.datasetVersionId,
          row.eventType,
          row.instrument,
          JSON.stringify(row.payload),
          row.occurredAt
        );
      }
      const result = await client.query(
        `
        INSERT INTO simulation_market_events (
          dataset_version_id, event_type, instrument, payload, occurred_at
        )
        VALUES ${values.join(', ')}
        RETURNING id
        `,
        params
      );
      return result.rowCount;
    },

    async listMarketEvents({
      datasetVersionId,
      instrument,
      startTime,
      endTime,
      limit = 100000,
    }) {
      const params = [datasetVersionId];
      const conditions = ['dataset_version_id = $1'];
      if (instrument) {
        params.push(instrument);
        conditions.push(`instrument = $${params.length}`);
      }
      if (startTime) {
        params.push(startTime);
        conditions.push(`occurred_at >= $${params.length}`);
      }
      if (endTime) {
        params.push(endTime);
        conditions.push(`occurred_at <= $${params.length}`);
      }
      params.push(limit);
      const result = await db.query(
        `
        SELECT * FROM simulation_market_events
        WHERE ${conditions.join(' AND ')}
        ORDER BY occurred_at ASC
        LIMIT $${params.length}
        `,
        params
      );
      return result.rows;
    },

    /* =========================================================================
     * RUNS
     * ====================================================================== */

    async insertRun(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_runs (
          environment_id, version, state, config, random_seed, engine_version, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.environmentId,
          data.version,
          data.state || 'queued',
          JSON.stringify(data.config),
          data.randomSeed || null,
          data.engineVersion || 'v1',
          data.createdBy || null,
        ]
      );
      return result.rows[0];
    },

    async findRunById(runId) {
      const result = await db.query(
        `SELECT * FROM simulation_runs WHERE id = $1`,
        [runId]
      );
      return result.rows[0] || null;
    },

    async updateRun(runId, fields) {
      const result = await db.query(
        `
        UPDATE simulation_runs
        SET state = COALESCE($2, state),
            metrics = COALESCE($3, metrics),
            warnings = COALESCE($4, warnings),
            started_at = COALESCE($5, started_at),
            completed_at = COALESCE($6, completed_at),
            error_message = COALESCE($7, error_message)
        WHERE id = $1
        RETURNING *
        `,
        [
          runId,
          fields.state ?? null,
          fields.metrics ? JSON.stringify(fields.metrics) : null,
          fields.warnings ? JSON.stringify(fields.warnings) : null,
          fields.startedAt ?? null,
          fields.completedAt ?? null,
          fields.errorMessage ?? null,
        ]
      );
      return result.rows[0] || null;
    },

    async listRuns(environmentId, { limit = 50, cursor = null } = {}) {
      const params = [environmentId, limit + 1];
      let cursorClause = '';
      if (cursor) {
        params.push(cursor);
        cursorClause = `AND created_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM simulation_runs
        WHERE environment_id = $1 ${cursorClause}
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

    async listRunsForWorkspace(workspaceId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT r.*, e.name AS environment_name, e.type AS environment_type
        FROM simulation_runs r
        JOIN simulation_environments e ON e.id = r.environment_id
        WHERE e.workspace_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2
        `,
        [workspaceId, limit]
      );
      return result.rows;
    },

    /* =========================================================================
     * RUN STEPS
     * ====================================================================== */

    async insertRunStep(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_run_steps (
          run_id, step_index, event_type, state, input, output, duration_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.runId,
          data.stepIndex,
          data.eventType || null,
          data.state,
          data.input ? JSON.stringify(data.input) : null,
          data.output ? JSON.stringify(data.output) : null,
          data.durationMs || null,
        ]
      );
      return result.rows[0];
    },

    async listRunSteps(runId, { limit = 1000 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM simulation_run_steps
        WHERE run_id = $1
        ORDER BY step_index ASC
        LIMIT $2
        `,
        [runId, limit]
      );
      return result.rows;
    },

    /* =========================================================================
     * SIMULATED ORDERS
     * ====================================================================== */

    async insertOrder(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_orders (
          run_id, account_id, instrument, market_type, side, type,
          quantity, price, status, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          data.runId,
          data.accountId,
          data.instrument,
          data.marketType,
          data.side,
          data.type,
          data.quantity,
          data.price || null,
          data.status || 'created',
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async updateOrder(orderId, fields) {
      const result = await db.query(
        `
        UPDATE simulation_orders
        SET status = COALESCE($2, status),
            filled_quantity = COALESCE($3, filled_quantity),
            average_fill_price = COALESCE($4, average_fill_price),
            metadata = COALESCE($5, metadata)
        WHERE id = $1
        RETURNING *
        `,
        [
          orderId,
          fields.status ?? null,
          fields.filledQuantity ?? null,
          fields.averageFillPrice ?? null,
          fields.metadata ? JSON.stringify(fields.metadata) : null,
        ]
      );
      return result.rows[0] || null;
    },

    async findOrderById(orderId) {
      const result = await db.query(
        `SELECT * FROM simulation_orders WHERE id = $1`,
        [orderId]
      );
      return result.rows[0] || null;
    },

    async listOrdersForRun(runId) {
      const result = await db.query(
        `SELECT * FROM simulation_orders WHERE run_id = $1 ORDER BY created_at`,
        [runId]
      );
      return result.rows;
    },

    async insertOrderEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_order_events (order_id, event_type, payload)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.orderId, data.eventType, JSON.stringify(data.payload || {})]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * SIMULATED FILLS
     * ====================================================================== */

    async insertFill(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_fills (order_id, quantity, price, fee, fee_asset, fill_model, executed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.orderId,
          data.quantity,
          data.price,
          data.fee || null,
          data.feeAsset || null,
          data.fillModel,
          data.executedAt,
        ]
      );
      return result.rows[0];
    },

    async listFillsForRun(runId) {
      const result = await db.query(
        `
        SELECT f.* FROM simulation_fills f
        JOIN simulation_orders o ON o.id = f.order_id
        WHERE o.run_id = $1
        ORDER BY f.executed_at ASC
        `,
        [runId]
      );
      return result.rows;
    },

    /* =========================================================================
     * SIMULATED POSITIONS
     * ====================================================================== */

    async upsertPosition(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_positions (
          run_id, account_id, instrument, side, quantity, entry_price,
          mark_price, unrealized_pnl, realized_pnl, leverage
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (run_id, account_id, instrument, side) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          entry_price = EXCLUDED.entry_price,
          mark_price = EXCLUDED.mark_price,
          unrealized_pnl = EXCLUDED.unrealized_pnl,
          realized_pnl = EXCLUDED.realized_pnl,
          leverage = EXCLUDED.leverage,
          updated_at = now()
        RETURNING *
        `,
        [
          data.runId,
          data.accountId,
          data.instrument,
          data.side,
          data.quantity,
          data.entryPrice,
          data.markPrice || null,
          data.unrealizedPnl || null,
          data.realizedPnl || null,
          data.leverage || null,
        ]
      );
      return result.rows[0];
    },

    async listPositionsForRun(runId) {
      const result = await db.query(
        `
        SELECT * FROM simulation_positions
        WHERE run_id = $1 AND quantity::numeric <> 0
        ORDER BY updated_at DESC
        `,
        [runId]
      );
      return result.rows;
    },

    async deletePosition(runId, accountId, instrument, side) {
      await db.query(
        `
        DELETE FROM simulation_positions
        WHERE run_id = $1 AND account_id = $2 AND instrument = $3 AND side = $4
        `,
        [runId, accountId, instrument, side]
      );
    },

    /* =========================================================================
     * COST EVENTS
     * ====================================================================== */

    async insertCostEvent(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_cost_events (run_id, account_id, cost_type, amount, asset, source, occurred_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.runId,
          data.accountId,
          data.costType,
          data.amount,
          data.asset,
          data.source || null,
          data.occurredAt || new Date(),
        ]
      );
      return result.rows[0];
    },

    /* =========================================================================
     * METRICS
     * ====================================================================== */

    async upsertMetric(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_metrics (run_id, metric_name, metric_value, metric_metadata)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (run_id, metric_name) DO UPDATE SET
          metric_value = EXCLUDED.metric_value,
          metric_metadata = EXCLUDED.metric_metadata
        RETURNING *
        `,
        [
          data.runId,
          data.metricName,
          data.metricValue,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async listMetricsForRun(runId) {
      const result = await db.query(
        `SELECT * FROM simulation_metrics WHERE run_id = $1`,
        [runId]
      );
      return result.rows;
    },

    /* =========================================================================
     * REPORTS
     * ====================================================================== */

    async insertReport(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_reports (run_id, version, storage_key, status, generated_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.runId,
          data.version || 1,
          data.storageKey || null,
          data.status || 'ready',
          data.generatedAt || new Date(),
        ]
      );
      return result.rows[0];
    },

    async listReportsForRun(runId) {
      const result = await db.query(
        `SELECT * FROM simulation_reports WHERE run_id = $1 ORDER BY version DESC`,
        [runId]
      );
      return result.rows;
    },

    /* =========================================================================
     * COMPARISONS
     * ====================================================================== */

    async insertComparison(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_comparisons (
          workspace_id, baseline_run_id, comparison_run_id, differences, warnings
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          data.workspaceId,
          data.baselineRunId,
          data.comparisonRunId,
          JSON.stringify(data.differences),
          JSON.stringify(data.warnings || []),
        ]
      );
      return result.rows[0];
    },

    async findComparisonById(id) {
      const result = await db.query(
        `SELECT * FROM simulation_comparisons WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async listComparisons(workspaceId, { limit = 50 } = {}) {
      const result = await db.query(
        `
        SELECT * FROM simulation_comparisons
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [workspaceId, limit]
      );
      return result.rows;
    },

    /* =========================================================================
     * SCENARIOS
     * ====================================================================== */

    async insertScenario(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_scenarios (workspace_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [data.workspaceId, data.name, data.description || null]
      );
      return result.rows[0];
    },

    async insertScenarioVersion(client, data) {
      const result = await client.query(
        `
        INSERT INTO simulation_scenario_versions (scenario_id, version, parameters)
        VALUES ($1, $2, $3)
        ON CONFLICT (scenario_id, version) DO NOTHING
        RETURNING *
        `,
        [data.scenarioId, data.version, JSON.stringify(data.parameters)]
      );
      return result.rows[0] || null;
    },

    async listScenariosForWorkspace(workspaceId) {
      const result = await db.query(
        `SELECT * FROM simulation_scenarios WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId]
      );
      return result.rows;
    },

    async findScenarioById(scenarioId) {
      const result = await db.query(
        `SELECT * FROM simulation_scenarios WHERE id = $1`,
        [scenarioId]
      );
      return result.rows[0] || null;
    },

    async listScenarioVersions(scenarioId) {
      const result = await db.query(
        `SELECT * FROM simulation_scenario_versions WHERE scenario_id = $1 ORDER BY version DESC`,
        [scenarioId]
      );
      return result.rows;
    },

    /* =========================================================================
     * AUDIT
     * ====================================================================== */

    async insertAuditEvent(client, data) {
      await client.query(
        `
        INSERT INTO simulation_audit_events (
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

    /* =========================================================================
     * RESOURCE USAGE
     * ====================================================================== */

    async insertResourceUsage(client, data) {
      await client.query(
        `
        INSERT INTO simulation_resource_usage (workspace_id, run_id, metric, value)
        VALUES ($1, $2, $3, $4)
        `,
        [data.workspaceId, data.runId || null, data.metric, data.value]
      );
    },
  };
}

export default createSimulationQueries;