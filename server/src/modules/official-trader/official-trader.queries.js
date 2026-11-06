/**
 * SyncExc Server — Official AI Trader queries
 */

const OPEN_EXECUTION_STATUSES = [
  'pending',
  'awaiting_confirmation',
  'submitted',
  'partially_filled',
  'filled',
  'uncertain',
  'reconciled',
];

export function createOfficialTraderQueries({ db }) {
  /* ===========================================================================
   * Provider and settings
   * ======================================================================== */

  async function getProvider(handle = 'syncexc-official', client = db) {
    const result = await client.query(
      `
      SELECT provider.*, settings.id AS settings_id,
             settings.status AS settings_status,
             settings.research_enabled,
             settings.execution_enabled,
             settings.research_interval_minutes,
             settings.research_timeframes,
             settings.primary_timeframe,
             settings.min_confidence,
             settings.max_analyses_per_run,
             settings.allowed_market_types,
             settings.allowed_strategies,
             settings.max_risk_per_trade_pct,
             settings.max_order_notional,
             settings.max_open_positions,
             settings.max_daily_exposure,
             settings.max_leverage,
             settings.max_daily_loss,
             settings.max_drawdown_pct,
             settings.max_slippage_bps,
             settings.trading_schedule,
             settings.publication_mode,
             settings.require_stop_loss,
             settings.copy_trading_enabled,
             settings.last_research_at,
             settings.last_execution_at,
             settings.last_reconciled_at
      FROM marketplace_provider_profiles provider
      JOIN official_trader_settings settings ON settings.provider_id = provider.id
      WHERE provider.handle = $1
      `,
      [handle],
    );
    return result.rows[0] || null;
  }

  async function getSettings(providerId, client = db) {
    const result = await client.query(
      `SELECT * FROM official_trader_settings WHERE provider_id = $1`,
      [providerId],
    );
    return result.rows[0] || null;
  }

  async function updateSettings(providerId, fields, client = db) {
    const allowed = [
      'status',
      'research_enabled',
      'execution_enabled',
      'research_interval_minutes',
      'research_timeframes',
      'primary_timeframe',
      'min_confidence',
      'max_analyses_per_run',
      'allowed_market_types',
      'allowed_strategies',
      'max_risk_per_trade_pct',
      'max_order_notional',
      'max_open_positions',
      'max_daily_exposure',
      'max_leverage',
      'max_daily_loss',
      'max_drawdown_pct',
      'max_slippage_bps',
      'trading_schedule',
      'publication_mode',
      'require_stop_loss',
      'copy_trading_enabled',
      'last_research_at',
      'last_execution_at',
      'last_reconciled_at',
    ];
    const entries = Object.entries(fields).filter(
      ([key, value]) => allowed.includes(key) && value !== undefined,
    );
    if (entries.length === 0) return getSettings(providerId, client);
    const values = entries.map(([, value]) => value);
    const assignments = entries
      .map(([key], index) => `${key} = $${index + 2}`)
      .join(', ');
    const result = await client.query(
      `UPDATE official_trader_settings SET ${assignments} WHERE provider_id = $1 RETURNING *`,
      [providerId, ...values],
    );
    return result.rows[0] || null;
  }

  /* ===========================================================================
   * Official exchange account assignments
   * ======================================================================== */

  async function listConnections(providerId, client = db) {
    const result = await client.query(
      `
      SELECT assignment.*,
             connection.label AS connection_label,
             connection.status AS connection_status,
             connection.environment AS connection_environment,
             connection.last_validated_at,
             account.account_type,
             account.status AS account_status,
             account.exchange_account_id
      FROM official_trader_connections assignment
      JOIN exchange_connections connection ON connection.id = assignment.connection_id
      JOIN exchange_accounts account ON account.id = assignment.account_id
      WHERE assignment.provider_id = $1
      ORDER BY assignment.is_default DESC, assignment.created_at ASC
      `,
      [providerId],
    );
    return result.rows;
  }

  async function resolveExchangeAdapterId(scopeRef, client = db) {
    const result = await client.query(
      `SELECT id FROM exchange_registry
       WHERE exchange_code = $1 OR id::text = $1
       LIMIT 1`,
      [scopeRef],
    );
    return result.rows[0]?.id || null;
  }

  async function findAssignedAccountId(providerId, accountId, client = db) {
    const result = await client.query(
      `SELECT account.id
       FROM official_trader_connections assignment
       JOIN exchange_accounts account ON account.id = assignment.account_id
       WHERE assignment.provider_id = $1
         AND account.id::text = $2
       LIMIT 1`,
      [providerId, accountId],
    );
    return result.rows[0]?.id || null;
  }

  async function findConnection(providerId, assignmentId, client = db) {
    const result = await client.query(
      `
      SELECT assignment.*,
             connection.label AS connection_label,
             connection.status AS connection_status,
             connection.environment AS connection_environment,
             account.account_type,
             account.status AS account_status
      FROM official_trader_connections assignment
      JOIN exchange_connections connection ON connection.id = assignment.connection_id
      JOIN exchange_accounts account ON account.id = assignment.account_id
      WHERE assignment.provider_id = $1 AND assignment.id = $2
      `,
      [providerId, assignmentId],
    );
    return result.rows[0] || null;
  }

  async function findAssignmentByConnectionAccount(providerId, connectionId, accountId, client = db) {
    const result = await client.query(
      `
      SELECT assignment.*,
             connection.label AS connection_label,
             connection.status AS connection_status,
             connection.environment AS connection_environment,
             account.account_type,
             account.status AS account_status
      FROM official_trader_connections assignment
      JOIN exchange_connections connection ON connection.id = assignment.connection_id
      JOIN exchange_accounts account ON account.id = assignment.account_id
      WHERE assignment.provider_id = $1
        AND assignment.connection_id = $2
        AND assignment.account_id = $3
      LIMIT 1
      `,
      [providerId, connectionId, accountId],
    );
    return result.rows[0] || null;
  }

  async function findDefaultConnection(providerId, client = db) {
    const result = await client.query(
      `
      SELECT assignment.*,
             connection.label AS connection_label,
             connection.status AS connection_status,
             connection.environment AS connection_environment,
             account.account_type,
             account.status AS account_status
      FROM official_trader_connections assignment
      JOIN exchange_connections connection ON connection.id = assignment.connection_id
      JOIN exchange_accounts account ON account.id = assignment.account_id
      WHERE assignment.provider_id = $1
        AND assignment.status = 'active'
        AND connection.status = 'active'
        AND account.status = 'active'
      ORDER BY assignment.is_default DESC, assignment.created_at ASC
      LIMIT 1
      `,
      [providerId],
    );
    return result.rows[0] || null;
  }

  async function clearDefault(providerId, client = db) {
    await client.query(
      `UPDATE official_trader_connections SET is_default = false
       WHERE provider_id = $1 AND is_default = true`,
      [providerId],
    );
  }

  async function insertConnection(data, client = db) {
    const result = await client.query(
      `
      INSERT INTO official_trader_connections (
        provider_id, connection_id, account_id, exchange_code, environment,
        label, is_default, status, allowed_market_types, allowed_symbols,
        max_order_notional, max_open_positions, max_daily_exposure, max_leverage,
        max_daily_loss, max_drawdown_pct, max_slippage_bps, created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18
      )
      RETURNING *
      `,
      [
        data.providerId,
        data.connectionId,
        data.accountId,
        data.exchangeCode,
        data.environment,
        data.label || null,
        Boolean(data.isDefault),
        data.status || 'active',
        data.allowedMarketTypes || ['spot', 'futures'],
        data.allowedSymbols || [],
        data.maxOrderNotional ?? null,
        data.maxOpenPositions ?? null,
        data.maxDailyExposure ?? null,
        data.maxLeverage ?? null,
        data.maxDailyLoss ?? null,
        data.maxDrawdownPct ?? null,
        data.maxSlippageBps ?? null,
        data.createdBy || null,
      ],
    );
    return result.rows[0];
  }

  async function updateConnection(providerId, assignmentId, fields, client = db) {
    const map = {
      label: 'label',
      isDefault: 'is_default',
      status: 'status',
      allowedMarketTypes: 'allowed_market_types',
      allowedSymbols: 'allowed_symbols',
      maxOrderNotional: 'max_order_notional',
      maxOpenPositions: 'max_open_positions',
      maxDailyExposure: 'max_daily_exposure',
      maxLeverage: 'max_leverage',
      maxDailyLoss: 'max_daily_loss',
      maxDrawdownPct: 'max_drawdown_pct',
      maxSlippageBps: 'max_slippage_bps',
    };
    const entries = Object.entries(fields).filter(
      ([key, value]) => map[key] && value !== undefined,
    );
    if (entries.length === 0) return findConnection(providerId, assignmentId, client);
    const values = entries.map(([, value]) => value);
    const assignments = entries
      .map(([key], index) => `${map[key]} = $${index + 3}`)
      .join(', ');
    const result = await client.query(
      `UPDATE official_trader_connections SET ${assignments}
       WHERE provider_id = $1 AND id = $2
       RETURNING *`,
      [providerId, assignmentId, ...values],
    );
    return result.rows[0] || null;
  }

  async function deleteConnection(providerId, assignmentId, client = db) {
    const result = await client.query(
      `DELETE FROM official_trader_connections
       WHERE provider_id = $1 AND id = $2
       RETURNING id`,
      [providerId, assignmentId],
    );
    return result.rows[0] || null;
  }

  /* ===========================================================================
   * Research runs
   * ======================================================================== */

  async function insertResearchRun(data) {
    const result = await db.query(
      `
      INSERT INTO official_trader_research_runs (
        provider_id, status, timeframes, symbols, data_sources, ai_provider, ai_model
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        data.providerId,
        data.status || 'running',
        data.timeframes || [],
        JSON.stringify(data.symbols || []),
        JSON.stringify(data.dataSources || []),
        data.aiProvider || null,
        data.aiModel || null,
      ],
    );
    return result.rows[0];
  }

  async function finishResearchRun(runId, fields) {
    const result = await db.query(
      `
      UPDATE official_trader_research_runs
      SET status = $2,
          candidates_generated = COALESCE($3, candidates_generated),
          analyses_created = COALESCE($4, analyses_created),
          rejected = COALESCE($5, rejected),
          summary = COALESCE($6, summary),
          error_message = $7,
          completed_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        runId,
        fields.status,
        fields.candidatesGenerated ?? null,
        fields.analysesCreated ?? null,
        fields.rejected ?? null,
        fields.summary ? JSON.stringify(fields.summary) : null,
        fields.errorMessage || null,
      ],
    );
    return result.rows[0] || null;
  }

  async function listResearchRuns(providerId, { limit = 50, offset = 0 }) {
    const [rows, count] = await Promise.all([
      db.query(
        `SELECT * FROM official_trader_research_runs
         WHERE provider_id = $1
         ORDER BY started_at DESC
         LIMIT $2 OFFSET $3`,
        [providerId, limit, offset],
      ),
      db.query(
        `SELECT count(*)::int AS total FROM official_trader_research_runs WHERE provider_id = $1`,
        [providerId],
      ),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total || 0 };
  }

  async function getResearchRun(providerId, runId) {
    const result = await db.query(
      `SELECT * FROM official_trader_research_runs WHERE provider_id = $1 AND id = $2`,
      [providerId, runId],
    );
    return result.rows[0] || null;
  }

  /* ===========================================================================
   * Analyses
   * ======================================================================== */

  async function insertAnalysis(data) {
    const result = await db.query(
      `
      INSERT INTO official_trader_analyses (
        provider_id, research_run_id, connection_id, account_id, exchange_code,
        instrument, market_type, direction, strategy_key, timeframe, order_type,
        entry_price, entry_low, entry_high, stop_loss, targets, risk_reward,
        position_size, risk_percentage, leverage, confidence, market_condition,
        reasoning, invalidation_condition, data_sources, indicators, status,
        expires_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, $28
      )
      RETURNING *
      `,
      [
        data.providerId,
        data.researchRunId || null,
        data.connectionId || null,
        data.accountId || null,
        data.exchangeCode,
        data.instrument,
        data.marketType,
        data.direction,
        data.strategyKey,
        data.timeframe,
        data.orderType || null,
        data.entryPrice ?? null,
        data.entryLow ?? null,
        data.entryHigh ?? null,
        data.stopLoss ?? null,
        JSON.stringify(data.targets || []),
        data.riskReward ?? null,
        data.positionSize ?? null,
        data.riskPercentage ?? null,
        data.leverage ?? null,
        data.confidence,
        data.marketCondition || null,
        data.reasoning,
        data.invalidationCondition || null,
        JSON.stringify(data.dataSources || []),
        JSON.stringify(data.indicators || {}),
        data.status || 'generated',
        data.expiresAt || null,
      ],
    );
    return result.rows[0];
  }

  async function updateAnalysis(analysisId, fields) {
    const map = {
      connectionId: 'connection_id',
      accountId: 'account_id',
      orderType: 'order_type',
      entryPrice: 'entry_price',
      stopLoss: 'stop_loss',
      targets: 'targets',
      riskReward: 'risk_reward',
      positionSize: 'position_size',
      riskPercentage: 'risk_percentage',
      leverage: 'leverage',
      status: 'status',
      validationResult: 'validation_result',
      rejectionReason: 'rejection_reason',
      riskEvaluationId: 'risk_evaluation_id',
      publishedSignalId: 'published_signal_id',
      expiresAt: 'expires_at',
      validatedAt: 'validated_at',
      executedAt: 'executed_at',
      publishedAt: 'published_at',
    };
    const entries = Object.entries(fields).filter(
      ([key, value]) => map[key] && value !== undefined,
    );
    if (entries.length === 0) return getAnalysisById(analysisId);
    const values = entries.map(([key, value]) =>
      ['targets', 'validationResult'].includes(key) ? JSON.stringify(value) : value,
    );
    const assignments = entries
      .map(([key], index) => `${map[key]} = $${index + 2}`)
      .join(', ');
    const result = await db.query(
      `UPDATE official_trader_analyses SET ${assignments}
       WHERE id = $1 RETURNING *`,
      [analysisId, ...values],
    );
    return result.rows[0] || null;
  }

  async function getAnalysisById(analysisId) {
    const result = await db.query(
      `SELECT * FROM official_trader_analyses WHERE id = $1`,
      [analysisId],
    );
    return result.rows[0] || null;
  }

  async function getAnalysis(providerId, analysisId) {
    const result = await db.query(
      `
      SELECT analysis.*,
             connection.label AS connection_label,
             account.account_type
      FROM official_trader_analyses analysis
      LEFT JOIN exchange_connections connection ON connection.id = analysis.connection_id
      LEFT JOIN exchange_accounts account ON account.id = analysis.account_id
      WHERE analysis.provider_id = $1 AND analysis.id = $2
      `,
      [providerId, analysisId],
    );
    return result.rows[0] || null;
  }

  async function listAnalyses(providerId, {
    status,
    marketType,
    instrument,
    limit = 50,
    offset = 0,
  } = {}) {
    const filters = ['provider_id = $1'];
    const values = [providerId];
    if (status) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }
    if (marketType) {
      values.push(marketType);
      filters.push(`market_type = $${values.length}`);
    }
    if (instrument) {
      values.push(`%${instrument}%`);
      filters.push(`instrument ILIKE $${values.length}`);
    }
    const where = filters.join(' AND ');
    values.push(limit, offset);
    const [rows, count] = await Promise.all([
      db.query(
        `SELECT * FROM official_trader_analyses
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      ),
      db.query(
        `SELECT count(*)::int AS total FROM official_trader_analyses WHERE ${where}`,
        values.slice(0, -2),
      ),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total || 0 };
  }

  async function findActiveAnalysisForInstrument(providerId, {
    exchangeCode,
    instrument,
    marketType,
  }) {
    const result = await db.query(
      `
      SELECT id, status, expires_at
      FROM official_trader_analyses
      WHERE provider_id = $1
        AND exchange_code = $2
        AND instrument = $3
        AND market_type = $4
        AND status IN (
          'generated', 'validated', 'execution_pending', 'executed',
          'partially_executed', 'published'
        )
        AND (expires_at IS NULL OR expires_at > now())
      LIMIT 1
      `,
      [providerId, exchangeCode, instrument, marketType],
    );
    return result.rows[0] || null;
  }

  async function listExecutableAnalyses(providerId, limit = 20) {
    const result = await db.query(
      `
      SELECT * FROM official_trader_analyses
      WHERE provider_id = $1
        AND status = 'validated'
        AND (expires_at IS NULL OR expires_at > now())
        AND published_signal_id IS NULL
      ORDER BY confidence DESC, created_at ASC
      LIMIT $2
      `,
      [providerId, limit],
    );
    return result.rows;
  }

  /* ===========================================================================
   * Executions and fills
   * ======================================================================== */

  async function nextExecutionNumber(analysisId) {
    const result = await db.query(
      `SELECT COALESCE(MAX(execution_number), 0) + 1 AS next
       FROM official_trader_executions WHERE analysis_id = $1`,
      [analysisId],
    );
    return Number(result.rows[0]?.next || 1);
  }

  async function insertExecution(data) {
    const result = await db.query(
      `
      INSERT INTO official_trader_executions (
        analysis_id, provider_id, connection_id, account_id, execution_number,
        instrument, market_type, side, order_type, requested_quantity, status,
        exchange_response
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        data.analysisId,
        data.providerId,
        data.connectionId,
        data.accountId,
        data.executionNumber,
        data.instrument,
        data.marketType,
        data.side,
        data.orderType,
        data.requestedQuantity,
        data.status || 'pending',
        data.exchangeResponse ? JSON.stringify(data.exchangeResponse) : null,
      ],
    );
    return result.rows[0];
  }

  async function updateExecution(executionId, fields) {
    const map = {
      status: 'status',
      tradingOrderId: 'trading_order_id',
      executionRequestId: 'execution_request_id',
      exchangeOrderId: 'exchange_order_id',
      clientOrderId: 'client_order_id',
      filledQuantity: 'filled_quantity',
      averageFillPrice: 'average_fill_price',
      fees: 'fees',
      feeAsset: 'fee_asset',
      exchangeResponse: 'exchange_response',
      errorMessage: 'error_message',
      submittedAt: 'submitted_at',
      lastReconciledAt: 'last_reconciled_at',
      closedAt: 'closed_at',
      realizedPnl: 'realized_pnl',
      pnlAsset: 'pnl_asset',
    };
    const entries = Object.entries(fields).filter(
      ([key, value]) => map[key] && value !== undefined,
    );
    if (entries.length === 0) return getExecutionById(executionId);
    const values = entries.map(([key, value]) =>
      key === 'exchangeResponse' ? JSON.stringify(value) : value,
    );
    const assignments = entries
      .map(([key], index) => `${map[key]} = $${index + 2}`)
      .join(', ');
    const result = await db.query(
      `UPDATE official_trader_executions SET ${assignments}
       WHERE id = $1 RETURNING *`,
      [executionId, ...values],
    );
    return result.rows[0] || null;
  }

  async function getExecutionById(executionId) {
    const result = await db.query(
      `SELECT * FROM official_trader_executions WHERE id = $1`,
      [executionId],
    );
    return result.rows[0] || null;
  }

  async function getExecution(providerId, executionId) {
    const result = await db.query(
      `
      SELECT execution.*,
             analysis.confidence,
             analysis.strategy_key,
             analysis.reasoning,
             analysis.targets,
             analysis.stop_loss AS analysis_stop_loss,
             analysis.entry_price AS analysis_entry_price,
             analysis.published_signal_id
      FROM official_trader_executions execution
      JOIN official_trader_analyses analysis ON analysis.id = execution.analysis_id
      WHERE execution.provider_id = $1 AND execution.id = $2
      `,
      [providerId, executionId],
    );
    return result.rows[0] || null;
  }

  async function listExecutions(providerId, {
    status,
    marketType,
    limit = 50,
    offset = 0,
  } = {}) {
    const filters = ['execution.provider_id = $1'];
    const values = [providerId];
    if (status) {
      values.push(status);
      filters.push(`execution.status = $${values.length}`);
    }
    if (marketType) {
      values.push(marketType);
      filters.push(`execution.market_type = $${values.length}`);
    }
    const where = filters.join(' AND ');
    const countValues = [...values];
    values.push(limit, offset);
    const [rows, count] = await Promise.all([
      db.query(
        `
        SELECT execution.*,
               analysis.confidence,
               analysis.strategy_key,
               analysis.published_signal_id,
               closure.realized_pnl AS closure_realized_pnl,
               closure.closed_at AS closure_closed_at,
               closure.outcome AS closure_outcome
        FROM official_trader_executions execution
        JOIN official_trader_analyses analysis ON analysis.id = execution.analysis_id
        LEFT JOIN official_trader_closures closure ON closure.execution_id = execution.id
        WHERE ${where}
        ORDER BY execution.created_at DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
      ),
      db.query(
        `SELECT count(*)::int AS total FROM official_trader_executions execution WHERE ${where}`,
        countValues,
      ),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total || 0 };
  }

  async function listExecutionsForAnalysis(analysisId) {
    const result = await db.query(
      `
      SELECT execution.*, closure.outcome AS closure_outcome
      FROM official_trader_executions execution
      LEFT JOIN official_trader_closures closure ON closure.execution_id = execution.id
      WHERE execution.analysis_id = $1
      ORDER BY execution.execution_number ASC
      `,
      [analysisId],
    );
    return result.rows;
  }

  async function listOpenExecutions(providerId) {
    const result = await db.query(
      `
      SELECT execution.*, analysis.published_signal_id, closure.id AS closure_id
      FROM official_trader_executions execution
      JOIN official_trader_analyses analysis ON analysis.id = execution.analysis_id
      LEFT JOIN official_trader_closures closure ON closure.execution_id = execution.id
      WHERE execution.provider_id = $1
        AND execution.closed_at IS NULL
        AND execution.status IN (
          'pending', 'awaiting_confirmation', 'submitted',
          'partially_filled', 'filled', 'uncertain', 'reconciled'
        )
      ORDER BY execution.created_at ASC
      `,
      [providerId],
    );
    return result.rows;
  }

  async function findExecutionByOrderId(orderId) {
    const result = await db.query(
      `SELECT * FROM official_trader_executions WHERE trading_order_id = $1`,
      [orderId],
    );
    return result.rows[0] || null;
  }

  async function copyFills(executionId) {
    const result = await db.query(
      `
      INSERT INTO official_trader_fills (
        execution_id, trading_fill_id, exchange_trade_id, quantity, price,
        fee_amount, fee_asset, executed_at
      )
      SELECT $1, fill.id, fill.exchange_trade_id, fill.quantity, fill.price,
             fill.fee_amount, fill.fee_asset, fill.executed_at
      FROM official_trader_executions execution
      JOIN trading_fills fill ON fill.order_id = execution.trading_order_id
      WHERE execution.id = $1
      ON CONFLICT (trading_fill_id) DO NOTHING
      RETURNING *
      `,
      [executionId],
    );
    return result.rows;
  }

  async function listFills(executionId) {
    const result = await db.query(
      `SELECT * FROM official_trader_fills
       WHERE execution_id = $1
       ORDER BY executed_at ASC`,
      [executionId],
    );
    return result.rows;
  }

  async function refreshExecutionFillTotals(executionId) {
    const result = await db.query(
      `
      UPDATE official_trader_executions execution
      SET filled_quantity = aggregate.quantity,
          average_fill_price = aggregate.average_price,
          fees = aggregate.fees,
          fee_asset = aggregate.fee_asset,
          last_reconciled_at = now()
      FROM (
        SELECT
          COALESCE(SUM(fill.quantity), 0) AS quantity,
          CASE WHEN SUM(fill.quantity) > 0
            THEN SUM(fill.quantity * fill.price) / SUM(fill.quantity)
            ELSE NULL
          END AS average_price,
          COALESCE(SUM(fill.fee_amount), 0) AS fees,
          MAX(fill.fee_asset) AS fee_asset
        FROM official_trader_fills fill
        WHERE fill.execution_id = $1
      ) aggregate
      WHERE execution.id = $1
      RETURNING execution.*
      `,
      [executionId],
    );
    return result.rows[0] || null;
  }

  /* ===========================================================================
   * Closed trade attribution and performance
   * ======================================================================== */

  async function insertClosure(data) {
    const result = await db.query(
      `
      INSERT INTO official_trader_closures (
        execution_id, provider_id, trading_closed_trade_id, closing_fill_id,
        closed_at, realized_pnl, fees, pnl_asset, outcome, attribution_evidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (trading_closed_trade_id) DO NOTHING
      RETURNING *
      `,
      [
        data.executionId,
        data.providerId,
        data.tradingClosedTradeId || null,
        data.closingFillId || null,
        data.closedAt,
        data.realizedPnl,
        data.fees || 0,
        data.pnlAsset || null,
        data.outcome,
        data.attributionEvidence ? JSON.stringify(data.attributionEvidence) : null,
      ],
    );
    return result.rows[0] || null;
  }

  async function findUnattributedClosedTrades(execution) {
    const result = await db.query(
      `
      SELECT closed_trade.*
      FROM trading_closed_trades closed_trade
      WHERE closed_trade.account_id = $1
        AND closed_trade.instrument = $2
        AND closed_trade.side = $3
        AND closed_trade.closed_at >= $4
        AND NOT EXISTS (
          SELECT 1 FROM official_trader_closures closure
          WHERE closure.trading_closed_trade_id = closed_trade.id
        )
      ORDER BY closed_trade.closed_at ASC
      `,
      [
        execution.account_id,
        execution.instrument,
        execution.side === 'buy' ? 'long' : 'short',
        execution.submitted_at || execution.created_at,
      ],
    );
    return result.rows;
  }

  async function listClosures(providerId, { limit = 50, offset = 0 } = {}) {
    const [rows, count] = await Promise.all([
      db.query(
        `
        SELECT closure.*, execution.instrument, execution.market_type,
               execution.side AS execution_side, execution.average_fill_price
        FROM official_trader_closures closure
        JOIN official_trader_executions execution ON execution.id = closure.execution_id
        WHERE closure.provider_id = $1
        ORDER BY closure.closed_at DESC
        LIMIT $2 OFFSET $3
        `,
        [providerId, limit, offset],
      ),
      db.query(
        `SELECT count(*)::int AS total FROM official_trader_closures WHERE provider_id = $1`,
        [providerId],
      ),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total || 0 };
  }

  async function performanceTotals(providerId) {
    const result = await db.query(
      `
      SELECT
        COUNT(*)::int AS closed_trades,
        COUNT(*) FILTER (WHERE outcome = 'win')::int AS wins,
        COUNT(*) FILTER (WHERE outcome = 'loss')::int AS losses,
        COUNT(*) FILTER (WHERE outcome = 'breakeven')::int AS breakeven,
        COALESCE(SUM(realized_pnl), 0)::text AS realized_pnl,
        COALESCE(SUM(fees), 0)::text AS close_fees
      FROM official_trader_closures
      WHERE provider_id = $1
      `,
      [providerId],
    );
    return result.rows[0];
  }

  async function performanceByMarketType(providerId) {
    const result = await db.query(
      `
      SELECT
        execution.market_type,
        COUNT(*)::int AS closed_trades,
        COUNT(*) FILTER (WHERE closure.outcome = 'win')::int AS wins,
        COUNT(*) FILTER (WHERE closure.outcome = 'loss')::int AS losses,
        COUNT(*) FILTER (WHERE closure.outcome = 'breakeven')::int AS breakeven,
        COALESCE(SUM(closure.realized_pnl), 0)::text AS realized_pnl,
        COALESCE(SUM(closure.fees), 0)::text AS fees
      FROM official_trader_closures closure
      JOIN official_trader_executions execution ON execution.id = closure.execution_id
      WHERE closure.provider_id = $1
      GROUP BY execution.market_type
      ORDER BY execution.market_type
      `,
      [providerId],
    );
    return result.rows;
  }

  async function performanceByAsset(providerId) {
    const result = await db.query(
      `
      SELECT
        COALESCE(NULLIF(pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
        COUNT(*)::int AS closed_trades,
        COUNT(*) FILTER (WHERE outcome = 'win')::int AS wins,
        COUNT(*) FILTER (WHERE outcome = 'loss')::int AS losses,
        COUNT(*) FILTER (WHERE outcome = 'breakeven')::int AS breakeven,
        COALESCE(SUM(realized_pnl), 0)::text AS realized_pnl,
        COALESCE(SUM(fees), 0)::text AS fees
      FROM official_trader_closures
      WHERE provider_id = $1
      GROUP BY COALESCE(NULLIF(pnl_asset, ''), 'UNKNOWN')
      ORDER BY pnl_asset
      `,
      [providerId],
    );
    return result.rows;
  }

  async function dailyPerformance(providerId) {
    const result = await db.query(
      `
      WITH daily AS (
        SELECT
          date_trunc('day', closure.closed_at) AS day,
          COALESCE(NULLIF(closure.pnl_asset, ''), 'UNKNOWN') AS pnl_asset,
          SUM(closure.realized_pnl) AS pnl
        FROM official_trader_closures closure
        WHERE closure.provider_id = $1
        GROUP BY date_trunc('day', closure.closed_at),
                 COALESCE(NULLIF(closure.pnl_asset, ''), 'UNKNOWN')
      )
      SELECT pnl_asset, day AS timestamp,
             SUM(pnl) OVER (PARTITION BY pnl_asset ORDER BY day)::text AS value,
             pnl::text AS daily_value
      FROM daily
      ORDER BY pnl_asset, day
      `,
      [providerId],
    );
    return result.rows;
  }

  async function executionAggregates(providerId) {
    const result = await db.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE closed_at IS NULL AND status IN (
          'pending', 'awaiting_confirmation', 'submitted',
          'partially_filled', 'filled', 'uncertain', 'reconciled'
        ))::int AS open_positions,
        COALESCE(SUM(fees), 0)::text AS open_fees,
        COALESCE(SUM(
          CASE WHEN closed_at IS NULL AND status IN (
            'pending', 'awaiting_confirmation', 'submitted',
            'partially_filled', 'filled', 'uncertain', 'reconciled'
          ) THEN COALESCE(filled_quantity, 0) * COALESCE(average_fill_price, 0)
          END
        ), 0)::text AS open_notional
      FROM official_trader_executions
      WHERE provider_id = $1
      `,
      [providerId],
    );
    return result.rows[0];
  }

  async function exposureToday(providerId) {
    const result = await db.query(
      `
      SELECT
        COALESCE(SUM(COALESCE(filled_quantity, 0) * COALESCE(average_fill_price, 0)), 0)::text AS notional,
        COUNT(*)::int AS entries
      FROM official_trader_executions
      WHERE provider_id = $1
        AND created_at >= date_trunc('day', now())
        AND status NOT IN ('rejected', 'failed', 'canceled', 'superseded', 'pending', 'awaiting_confirmation')
      `,
      [providerId],
    );
    return result.rows[0];
  }

  async function realizedToday(providerId) {
    const result = await db.query(
      `
      SELECT COALESCE(SUM(realized_pnl), 0)::text AS realized_pnl
      FROM official_trader_closures
      WHERE provider_id = $1
        AND closed_at >= date_trunc('day', now())
      `,
      [providerId],
    );
    return result.rows[0]?.realized_pnl || '0';
  }

  async function insertPerformanceSnapshot(data) {
    const result = await db.query(
      `
      INSERT INTO official_trader_performance_snapshots (
        provider_id, period_start, period_end, metrics, methodology
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (provider_id, period_start, period_end)
      DO UPDATE SET metrics = EXCLUDED.metrics,
                    methodology = EXCLUDED.methodology,
                    calculated_at = now()
      RETURNING *
      `,
      [
        data.providerId,
        data.periodStart,
        data.periodEnd,
        JSON.stringify(data.metrics),
        JSON.stringify(data.methodology),
      ],
    );
    return result.rows[0];
  }

  async function listPerformanceSnapshots(providerId, limit = 30) {
    const result = await db.query(
      `SELECT * FROM official_trader_performance_snapshots
       WHERE provider_id = $1
       ORDER BY period_end DESC
       LIMIT $2`,
      [providerId, limit],
    );
    return result.rows;
  }

  /* ===========================================================================
   * Lifecycle events
   * ======================================================================== */

  async function insertEvent(data) {
    const result = await db.query(
      `
      INSERT INTO official_trader_events (
        provider_id, analysis_id, execution_id, event_type, message, payload, actor_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        data.providerId,
        data.analysisId || null,
        data.executionId || null,
        data.eventType,
        data.message || null,
        data.payload ? JSON.stringify(data.payload) : null,
        data.actorId || null,
      ],
    );
    return result.rows[0];
  }

  async function listEvents(providerId, { limit = 50, offset = 0, eventType } = {}) {
    const filters = ['provider_id = $1'];
    const values = [providerId];
    if (eventType) {
      values.push(eventType);
      filters.push(`event_type = $${values.length}`);
    }
    const where = filters.join(' AND ');
    const countValues = [...values];
    values.push(limit, offset);
    const [rows, count] = await Promise.all([
      db.query(
        `SELECT * FROM official_trader_events
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      ),
      db.query(
        `SELECT count(*)::int AS total FROM official_trader_events WHERE ${where}`,
        countValues,
      ),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total || 0 };
  }

  async function countByStatus(providerId, table, statusColumn = 'status') {
    const result = await db.query(
      `SELECT ${statusColumn} AS status, count(*)::int AS count
       FROM ${table}
       WHERE provider_id = $1
       GROUP BY ${statusColumn}`,
      [providerId],
    );
    return result.rows.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});
  }

  async function listSubscribers(providerId, { limit = 50, offset = 0 } = {}) {
    const [rows, count] = await Promise.all([
      db.query(
        `
        SELECT subscription.*, account_user.email, account_user.display_name,
               membership.role AS role_in_workspace
        FROM marketplace_subscriptions subscription
        LEFT JOIN users account_user ON account_user.id = subscription.subscriber_user_id
        LEFT JOIN workspace_memberships membership
          ON membership.user_id = subscription.subscriber_user_id
         AND membership.workspace_id = subscription.workspace_id
         AND membership.removed_at IS NULL
        WHERE subscription.provider_id = $1
        ORDER BY subscription.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [providerId, limit, offset],
      ),
      db.query(
        `SELECT count(*)::int AS total FROM marketplace_subscriptions WHERE provider_id = $1`,
        [providerId],
      ),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total || 0 };
  }

  async function listCopyOperations(providerId, { limit = 50, offset = 0 } = {}) {
    const [rows, count] = await Promise.all([
      db.query(
        `
        SELECT execution.*, account_user.email,
               published_signal.instrument,
               published_signal.direction AS signal_direction
        FROM marketplace_trader_signal_executions execution
        JOIN marketplace_published_signals published_signal
          ON published_signal.id = execution.signal_id
        LEFT JOIN users account_user ON account_user.id = execution.user_id
        WHERE published_signal.provider_id = $1
        ORDER BY execution.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [providerId, limit, offset],
      ),
      db.query(
        `
        SELECT count(*)::int AS total
        FROM marketplace_trader_signal_executions execution
        JOIN marketplace_published_signals published_signal
          ON published_signal.id = execution.signal_id
        WHERE published_signal.provider_id = $1
        `,
        [providerId],
      ),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total || 0 };
  }

  async function listPublishedSignals(providerId, { status, limit = 50, offset = 0 } = {}) {
    const filters = ['signal.provider_id = $1'];
    const values = [providerId];
    if (status) {
      values.push(status);
      filters.push(`signal.status = $${values.length}`);
    }
    const where = filters.join(' AND ');
    const countValues = [...values];
    values.push(limit, offset);
    const [rows, count] = await Promise.all([
      db.query(
        `
        SELECT signal.*, analysis.id AS analysis_id, execution.id AS execution_id
        FROM marketplace_published_signals signal
        LEFT JOIN official_trader_analyses analysis ON analysis.published_signal_id = signal.id
        LEFT JOIN official_trader_executions execution ON execution.analysis_id = analysis.id
        WHERE ${where}
        ORDER BY signal.created_at DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values,
      ),
      db.query(
        `SELECT count(*)::int AS total FROM marketplace_published_signals signal WHERE ${where}`,
        countValues,
      ),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total || 0 };
  }

  async function listProviderPlans(providerId) {
    const result = await db.query(
      `SELECT * FROM marketplace_provider_plans
       WHERE provider_id = $1
       ORDER BY created_at DESC`,
      [providerId],
    );
    return result.rows;
  }

  async function getProviderPlan(providerId, planId, client = db) {
    const result = await client.query(
      `SELECT * FROM marketplace_provider_plans
       WHERE provider_id = $1 AND id = $2`,
      [providerId, planId],
    );
    return result.rows[0] || null;
  }

  async function insertProviderPlan({ providerId, name, pricing, entitlements }, client = db) {
    const result = await client.query(
      `INSERT INTO marketplace_provider_plans (provider_id, name, pricing, entitlements, status)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, 'draft')
       RETURNING *`,
      [providerId, name, JSON.stringify(pricing), JSON.stringify(entitlements || {})],
    );
    return result.rows[0];
  }

  async function updateProviderPlan(planId, fields, client = db) {
    const sets = [];
    const params = [planId];
    for (const [key, column] of [
      ['name', 'name'],
      ['pricing', 'pricing'],
      ['entitlements', 'entitlements'],
      ['flutterwavePaymentPlanId', 'flutterwave_payment_plan_id'],
    ]) {
      if (fields[key] !== undefined) {
        params.push(key === 'pricing' || key === 'entitlements'
          ? JSON.stringify(fields[key])
          : fields[key]);
        sets.push(`${column} = $${params.length}${key === 'pricing' || key === 'entitlements' ? '::jsonb' : ''}`);
      }
    }
    if (sets.length === 0) {
      const existing = await client.query(
        `SELECT * FROM marketplace_provider_plans WHERE id = $1`,
        [planId],
      );
      return existing.rows[0] || null;
    }
    const result = await client.query(
      `UPDATE marketplace_provider_plans SET ${sets.join(', ')}
       WHERE id = $1 RETURNING *`,
      params,
    );
    return result.rows[0] || null;
  }

  async function updateProviderPlanStatus(planId, status, client = db) {
    const result = await client.query(
      `UPDATE marketplace_provider_plans SET status = $2
       WHERE id = $1 RETURNING *`,
      [planId, status],
    );
    return result.rows[0] || null;
  }

  async function insertProviderPlanVersion(plan, client = db) {
    const result = await client.query(
      `INSERT INTO marketplace_provider_plan_versions (plan_id, version, snapshot)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (plan_id, version) DO UPDATE SET snapshot = EXCLUDED.snapshot
       RETURNING *`,
      [plan.id, plan.version, JSON.stringify(plan)],
    );
    return result.rows[0];
  }

  async function marketplaceSummary(providerId) {
    const result = await db.query(
      `
      SELECT
        (SELECT count(*)::int FROM marketplace_published_signals WHERE provider_id = $1) AS signals,
        (SELECT count(*)::int FROM marketplace_published_signals WHERE provider_id = $1 AND status = 'closed') AS closed_signals,
        (SELECT count(*)::int FROM marketplace_subscriptions WHERE provider_id = $1 AND status = 'active') AS active_subscriptions,
        (SELECT count(*)::int FROM marketplace_subscriptions WHERE provider_id = $1 AND status IN ('following', 'subscription_pending')) AS pending_subscriptions,
        (SELECT count(*)::int FROM marketplace_provider_plans WHERE provider_id = $1 AND status = 'active') AS active_plans,
        (SELECT count(*)::int
           FROM marketplace_trader_signal_executions execution
           JOIN marketplace_published_signals signal ON signal.id = execution.signal_id
          WHERE signal.provider_id = $1) AS copy_executions,
        (SELECT count(*)::int
           FROM marketplace_trader_signal_executions execution
           JOIN marketplace_published_signals signal ON signal.id = execution.signal_id
          WHERE signal.provider_id = $1 AND execution.status = 'filled') AS filled_copy_executions
      `,
      [providerId],
    );
    return result.rows[0] || {};
  }

  async function closePublishedSignalForExecution(executionId, { realizedPnl, pnlAsset, closedAt }) {
    const result = await db.query(
      `
      UPDATE marketplace_published_signals signal
      SET status = 'closed',
          realized_pnl = $2,
          pnl_asset = $3,
          closed_at = $4,
          updated_at = now()
      FROM official_trader_executions execution
      JOIN official_trader_analyses analysis ON analysis.id = execution.analysis_id
      WHERE execution.id = $1
        AND signal.id = analysis.published_signal_id
        AND signal.status IN ('published', 'updated')
      RETURNING signal.*
      `,
      [executionId, realizedPnl, pnlAsset || null, closedAt],
    );
    return result.rows[0] || null;
  }

  return {
    getProvider,
    getSettings,
    updateSettings,
    listConnections,
    resolveExchangeAdapterId,
    findAssignedAccountId,
    findConnection,
    findAssignmentByConnectionAccount,
    findDefaultConnection,
    clearDefault,
    insertConnection,
    updateConnection,
    deleteConnection,
    insertResearchRun,
    finishResearchRun,
    listResearchRuns,
    getResearchRun,
    insertAnalysis,
    updateAnalysis,
    getAnalysisById,
    getAnalysis,
    listAnalyses,
    findActiveAnalysisForInstrument,
    listExecutableAnalyses,
    nextExecutionNumber,
    insertExecution,
    updateExecution,
    getExecutionById,
    getExecution,
    listExecutions,
    listExecutionsForAnalysis,
    listOpenExecutions,
    findExecutionByOrderId,
    copyFills,
    listFills,
    refreshExecutionFillTotals,
    insertClosure,
    findUnattributedClosedTrades,
    listClosures,
    performanceTotals,
    performanceByMarketType,
    performanceByAsset,
    dailyPerformance,
    executionAggregates,
    exposureToday,
    realizedToday,
    insertPerformanceSnapshot,
    listPerformanceSnapshots,
    insertEvent,
    listEvents,
    countByStatus,
    listSubscribers,
    listCopyOperations,
    listPublishedSignals,
    listProviderPlans,
    getProviderPlan,
    insertProviderPlan,
    updateProviderPlan,
    updateProviderPlanStatus,
    insertProviderPlanVersion,
    marketplaceSummary,
    closePublishedSignalForExecution,
    OPEN_EXECUTION_STATUSES,
  };
}

export default createOfficialTraderQueries;
