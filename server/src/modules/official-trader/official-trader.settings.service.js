/**
 * SyncExc Server — Official AI Trader settings and exchange assignments
 */

import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';

const SETTINGS_FIELDS = new Set([
  'status',
  'researchEnabled',
  'executionEnabled',
  'researchIntervalMinutes',
  'researchTimeframes',
  'primaryTimeframe',
  'minConfidence',
  'maxAnalysesPerRun',
  'allowedMarketTypes',
  'allowedStrategies',
  'maxRiskPerTradePct',
  'maxOrderNotional',
  'maxOpenPositions',
  'maxDailyExposure',
  'maxLeverage',
  'maxDailyLoss',
  'maxDrawdownPct',
  'maxSlippageBps',
  'tradingSchedule',
  'publicationMode',
  'requireStopLoss',
  'copyTradingEnabled',
]);

const COLUMN_MAP = {
  status: 'status',
  researchEnabled: 'research_enabled',
  executionEnabled: 'execution_enabled',
  researchIntervalMinutes: 'research_interval_minutes',
  researchTimeframes: 'research_timeframes',
  primaryTimeframe: 'primary_timeframe',
  minConfidence: 'min_confidence',
  maxAnalysesPerRun: 'max_analyses_per_run',
  allowedMarketTypes: 'allowed_market_types',
  allowedStrategies: 'allowed_strategies',
  maxRiskPerTradePct: 'max_risk_per_trade_pct',
  maxOrderNotional: 'max_order_notional',
  maxOpenPositions: 'max_open_positions',
  maxDailyExposure: 'max_daily_exposure',
  maxLeverage: 'max_leverage',
  maxDailyLoss: 'max_daily_loss',
  maxDrawdownPct: 'max_drawdown_pct',
  maxSlippageBps: 'max_slippage_bps',
  tradingSchedule: 'trading_schedule',
  publicationMode: 'publication_mode',
  requireStopLoss: 'require_stop_loss',
  copyTradingEnabled: 'copy_trading_enabled',
};

const ALLOWED_MARKET_TYPES = new Set(['spot', 'futures']);
const ALLOWED_TIMEFRAMES = new Set(['5m', '15m', '30m', '1h', '2h', '4h', '1d']);
const ALLOWED_STATUSES = new Set(['enabled', 'paused', 'suspended']);

export function createOfficialTraderSettingsService({
  db,
  queries,
  connections,
  risk,
  events,
  logger,
  getAudit,
  getProvider,
}) {
  async function getOverview() {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const [assignments, counts] = await Promise.all([
      queries.listConnections(provider.id),
      loadCounts(provider.id),
    ]);
    return {
      provider: publicProvider(provider),
      settings: publicSettings(provider),
      connections: assignments.map(publicAssignment),
      counts,
    };
  }

  async function updateSettings({ actorId, fields, reason }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const normalized = normalizeSettingsPatch(fields);
    if (Object.keys(normalized).length === 0) {
      throw new ValidationError('No supported settings fields were supplied');
    }
    if (normalized.status && !ALLOWED_STATUSES.has(normalized.status)) {
      throw new ValidationError('Invalid official trader status');
    }
    if (normalized.publicationMode && !['execution_verified', 'research_only'].includes(normalized.publicationMode)) {
      throw new ValidationError('Invalid publication mode');
    }
    if (
      normalized.maxRiskPerTradePct != null &&
      (!Number.isFinite(normalized.maxRiskPerTradePct) ||
        normalized.maxRiskPerTradePct <= 0 ||
        normalized.maxRiskPerTradePct > 10)
    ) {
      throw new ValidationError('Maximum risk per trade must be between 0 and 10 percent');
    }
    if (normalized.maxOrderNotional != null && !(Number(normalized.maxOrderNotional) > 0)) {
      throw new ValidationError('Maximum order notional must be positive');
    }

    const before = publicSettings(provider);
    const updated = await queries.updateSettings(provider.id, normalized);
    await recordEvent({
      providerId: provider.id,
      eventType: normalized.status === 'paused' ? 'settings.paused'
        : normalized.status === 'enabled' ? 'settings.enabled'
        : 'settings.updated',
      message: normalized.status ? `Official trader status changed to ${normalized.status}` : 'Official trader settings updated',
      payload: { before, after: publicSettings({ ...provider, ...updated }) },
      actorId,
    });
    await audit({
      actorId,
      action: 'official_trader.settings.update',
      targetResource: 'official_trader_settings',
      targetId: provider.settings_id,
      reason: reason || 'Administrator updated official trader settings',
      before,
      after: publicSettings({ ...provider, ...updated }),
    });
    await safePublish('official_trader.settings_updated', {
      providerId: provider.id,
      status: updated.status,
      executionEnabled: updated.execution_enabled,
    }, actorId);
    return publicSettings({ ...provider, ...updated });
  }

  async function listAvailableConnections() {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const result = await db.query(
      `
      SELECT connection.id AS connection_id,
             connection.exchange_code,
             connection.environment,
             connection.label,
             connection.status,
             account.id AS account_id,
             account.account_type,
             account.status AS account_status,
             EXISTS (
               SELECT 1 FROM official_trader_connections assignment
               WHERE assignment.provider_id = $1
                 AND assignment.connection_id = connection.id
                 AND assignment.account_id = account.id
             ) AS already_assigned
      FROM exchange_connections connection
      JOIN exchange_accounts account ON account.connection_id = connection.id
      WHERE connection.workspace_id = $2
         OR EXISTS (
           SELECT 1 FROM official_trader_connections assignment
           WHERE assignment.provider_id = $1
             AND assignment.connection_id = connection.id
         )
      ORDER BY connection.created_at DESC, account.account_type
      `,
      [provider.id, provider.workspace_id],
    );
    return result.rows;
  }

  async function connectExchange({
    actorId,
    exchange,
    environment,
    label,
    credentials,
    accountType,
    allowedMarketTypes,
    makeDefault = true,
  }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    if (!exchange || !credentials?.apiKey || !credentials?.apiSecret) {
      throw new ValidationError('Exchange, API key, and API secret are required');
    }
    if (!label || String(label).trim().length < 3) {
      throw new ValidationError('A connection label of at least 3 characters is required');
    }

    const connection = await connections.service.createConnection({
      userId: provider.user_id,
      workspaceId: provider.workspace_id,
      exchange: String(exchange).toLowerCase(),
      environment: environment || 'live',
      label: String(label).trim().slice(0, 80),
      credentials,
    });

    const accountsResult = await db.query(
      `SELECT * FROM exchange_accounts WHERE connection_id = $1 ORDER BY account_type`,
      [connection.id],
    );
    const accounts = accountsResult.rows;
    if (accounts.length === 0) {
      throw new ConflictError(
        'The connection was created but no exchange accounts were discovered. Check the API key permissions.',
        'NO_ACCOUNTS_DISCOVERED',
      );
    }
    const preferred = accountType
      ? accounts.find((account) => account.account_type === accountType)
      : accounts.find((account) => account.account_type !== 'spot') || accounts[0];
    if (!preferred) {
      throw new ValidationError('The selected account type was not discovered on this connection');
    }

    const existing = await queries.findDefaultConnection(provider.id);
    const assignment = await queries.insertConnection({
      providerId: provider.id,
      connectionId: connection.id,
      accountId: preferred.id,
      exchangeCode: connection.exchange_code,
      environment: connection.environment,
      label: connection.label,
      isDefault: Boolean(makeDefault || !existing),
      status: 'active',
      allowedMarketTypes: allowedMarketTypes || ['spot', 'futures'],
      allowedSymbols: [],
      createdBy: actorId,
    });
    if (assignment.is_default) {
      await queries.clearDefault(provider.id);
      await queries.updateConnection(provider.id, assignment.id, { isDefault: true });
    }

    await recordEvent({
      providerId: provider.id,
      eventType: 'connection.assigned',
      message: `Official exchange account assigned: ${connection.label} (${connection.exchange_code})`,
      payload: { connectionId: connection.id, accountId: preferred.id },
      actorId,
    });
    await audit({
      actorId,
      action: 'official_trader.connection.create',
      targetResource: 'official_trader_connection',
      targetId: assignment.id,
      reason: 'Administrator connected an official exchange account',
      after: { connectionId: connection.id, accountId: preferred.id, exchange: connection.exchange_code },
    });
    await safePublish('official_trader.connection_assigned', {
      providerId: provider.id,
      assignmentId: assignment.id,
      connectionId: connection.id,
      accountId: preferred.id,
      exchange: connection.exchange_code,
    }, actorId);

    const refreshed = await queries.findConnection(provider.id, assignment.id);
    return publicAssignment(refreshed);
  }

  async function assignExistingConnection({
    actorId,
    connectionId,
    accountId,
    isDefault = false,
    allowedMarketTypes,
    allowedSymbols,
    limits,
  }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const accountResult = await db.query(
      `
      SELECT account.*, connection.exchange_code, connection.environment, connection.status AS connection_status
      FROM exchange_accounts account
      JOIN exchange_connections connection ON connection.id = account.connection_id
      WHERE account.id = $1 AND account.connection_id = $2
      `,
      [accountId, connectionId],
    );
    const account = accountResult.rows[0];
    if (!account) throw new NotFoundError('Exchange account');
    if (account.connection_status !== 'active' || account.status !== 'active') {
      throw new ConflictError('Only active exchange accounts can be assigned to the official trader', 'ACCOUNT_NOT_ACTIVE');
    }

    const existingDefault = await queries.findDefaultConnection(provider.id);
    const assignment = await queries.insertConnection({
      providerId: provider.id,
      connectionId,
      accountId,
      exchangeCode: account.exchange_code,
      environment: account.environment,
      label: null,
      isDefault: Boolean(isDefault || !existingDefault),
      status: 'active',
      allowedMarketTypes: allowedMarketTypes || ['spot', 'futures'],
      allowedSymbols: allowedSymbols || [],
      maxOrderNotional: limits?.maxOrderNotional,
      maxOpenPositions: limits?.maxOpenPositions,
      maxDailyExposure: limits?.maxDailyExposure,
      maxLeverage: limits?.maxLeverage,
      maxDailyLoss: limits?.maxDailyLoss,
      maxDrawdownPct: limits?.maxDrawdownPct,
      maxSlippageBps: limits?.maxSlippageBps,
      createdBy: actorId,
    });
    if (assignment.is_default) {
      await queries.clearDefault(provider.id);
      await queries.updateConnection(provider.id, assignment.id, { isDefault: true });
    }
    await recordEvent({
      providerId: provider.id,
      eventType: 'connection.assigned',
      message: `Existing exchange account assigned to the official trader`,
      payload: { connectionId, accountId },
      actorId,
    });
    await audit({
      actorId,
      action: 'official_trader.connection.assign',
      targetResource: 'official_trader_connection',
      targetId: assignment.id,
      reason: 'Administrator assigned an existing exchange account',
      after: { connectionId, accountId },
    });
    const refreshed = await queries.findConnection(provider.id, assignment.id);
    return publicAssignment(refreshed);
  }

  async function updateConnection({ actorId, assignmentId, fields, reason }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const before = await queries.findConnection(provider.id, assignmentId);
    if (!before) throw new NotFoundError('Official trader connection');
    const updated = await queries.updateConnection(provider.id, assignmentId, fields);
    if (fields.isDefault) {
      await queries.clearDefault(provider.id);
      await queries.updateConnection(provider.id, assignmentId, { isDefault: true });
    }
    await recordEvent({
      providerId: provider.id,
      eventType: 'connection.updated',
      message: `Official trader connection updated`,
      payload: { before, after: updated },
      actorId,
    });
    await audit({
      actorId,
      action: 'official_trader.connection.update',
      targetResource: 'official_trader_connection',
      targetId: assignmentId,
      reason: reason || 'Administrator updated an official trader connection',
      before,
      after: updated,
    });
    const refreshed = await queries.findConnection(provider.id, assignmentId);
    return publicAssignment(refreshed);
  }

  async function removeConnection({ actorId, assignmentId, reason }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const existing = await queries.findConnection(provider.id, assignmentId);
    if (!existing) throw new NotFoundError('Official trader connection');
    const open = await db.query(
      `SELECT count(*)::int AS count FROM official_trader_executions
       WHERE connection_id = $1 AND closed_at IS NULL
         AND status IN ('pending', 'submitted', 'partially_filled', 'filled', 'uncertain', 'reconciled')`,
      [existing.connection_id],
    );
    if ((open.rows[0]?.count || 0) > 0) {
      throw new ConflictError(
        'This connection still has open official executions. Reconcile or close them before removing the assignment.',
        'OPEN_EXECUTIONS',
      );
    }
    await queries.deleteConnection(provider.id, assignmentId);
    await recordEvent({
      providerId: provider.id,
      eventType: 'connection.removed',
      message: 'Official trader connection assignment removed',
      payload: existing,
      actorId,
    });
    await audit({
      actorId,
      action: 'official_trader.connection.remove',
      targetResource: 'official_trader_connection',
      targetId: assignmentId,
      reason: reason || 'Administrator removed an official trader connection',
      before: existing,
    });
    return { removed: true };
  }

  async function getExchangeCatalog() {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const [exchanges, instruments] = await Promise.all([
      db.query(
        `SELECT exchange_code, display_name, integration_status, metadata
         FROM exchange_registry ORDER BY display_name`,
      ),
      db.query(
        `
        SELECT exchange_code, market_type, count(*)::int AS instruments
        FROM exchange_instruments
        WHERE trading_status = 'active'
        GROUP BY exchange_code, market_type
        ORDER BY exchange_code, market_type
        `,
      ),
    ]);
    return { exchanges: exchanges.rows, instruments: instruments.rows };
  }

  async function emergencyPause({ actorId, reason, scope = 'workspace', scopeRef = null }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    if (!reason || String(reason).trim().length < 10) {
      throw new ValidationError('An emergency pause reason of at least 10 characters is required');
    }
    if (!['workspace', 'exchange_adapter', 'destination_account'].includes(scope)) {
      throw new ValidationError('Unsupported emergency pause scope');
    }
    if (scope !== 'workspace' && !scopeRef) {
      throw new ValidationError(`A ${scope} scope reference is required`);
    }
    let resolvedScopeRef = provider.workspace_id;
    if (scope === 'exchange_adapter') {
      resolvedScopeRef = await queries.resolveExchangeAdapterId(String(scopeRef).trim());
      if (!resolvedScopeRef) {
        throw new ValidationError(`Unknown exchange adapter: ${scopeRef}`);
      }
    } else if (scope === 'destination_account') {
      resolvedScopeRef = await queries.findAssignedAccountId(provider.id, String(scopeRef).trim());
      if (!resolvedScopeRef) {
        throw new ValidationError('The destination account is not assigned to the official trader');
      }
    }
    const pause = await risk.emergencyPause.request({
      userId: actorId,
      workspaceId: provider.workspace_id,
      scope,
      scopeRef: resolvedScopeRef,
      reason: String(reason).trim().slice(0, 1000),
    });
    const isGlobalPause = scope === 'workspace';
    if (isGlobalPause) {
      await queries.updateSettings(provider.id, { status: 'paused' });
    }
    const displayScopeRef = scope === 'workspace' ? provider.workspace_id : String(scopeRef).trim();
    await recordEvent({
      providerId: provider.id,
      eventType: 'emergency.paused',
      message: reason,
      payload: { pauseId: pause.id, scope, scopeRef: displayScopeRef, scopeId: resolvedScopeRef },
      actorId,
    });
    await audit({
      actorId,
      action: 'official_trader.emergency_pause',
      targetResource: 'official_trader_settings',
      targetId: provider.settings_id,
      reason,
      after: { pauseId: pause.id, scope, scopeRef: displayScopeRef, scopeId: resolvedScopeRef },
    });
    await safePublish('official_trader.paused', {
      providerId: provider.id,
      pauseId: pause.id,
      scope,
      scopeRef: displayScopeRef,
      scopeId: resolvedScopeRef,
      reason,
    }, actorId);
    const open = await queries.listOpenExecutions(provider.id);
    return {
      pause,
      status: isGlobalPause ? 'paused' : provider.settings_status,
      scope,
      scopeRef: displayScopeRef,
      scopeId: resolvedScopeRef,
      stopped: isGlobalPause
        ? ['New official research execution and order submission are blocked.']
        : [`New official order submission for ${scope} ${displayScopeRef} is blocked.`],
      notStopped: [
        'Exchange-accepted orders were not cancelled.',
        'Existing exchange positions were not closed.',
        'Open executions continue to be reconciled.',
      ],
      openExecutions: open.length,
    };
  }

  async function resume({ actorId, reason, pauseId = null }) {
    const provider = await getProvider();
    if (!provider) throw new NotFoundError('Official AI Trader provider');
    const active = await db.query(
      `
      SELECT id FROM risk_emergency_pause_events
      WHERE workspace_id = $1 AND status IN ('requested', 'propagating', 'active')
        ${pauseId ? 'AND id = $2' : ''}
      ORDER BY created_at DESC
      `,
      pauseId ? [provider.workspace_id, pauseId] : [provider.workspace_id],
    );
    for (const row of active.rows) {
      await risk.emergencyPause.resume({
        userId: actorId,
        workspaceId: provider.workspace_id,
        pauseId: row.id,
      });
    }
    const remaining = await db.query(
      `SELECT count(*)::int AS count FROM risk_emergency_pause_events
       WHERE workspace_id = $1 AND status IN ('requested', 'propagating', 'active')`,
      [provider.workspace_id],
    );
    if ((remaining.rows[0]?.count || 0) === 0) {
      await queries.updateSettings(provider.id, { status: 'enabled' });
    }
    await recordEvent({
      providerId: provider.id,
      eventType: 'emergency.resumed',
      message: reason || 'Official trader resumed by administrator',
      payload: { resumedPauses: active.rows.map((row) => row.id) },
      actorId,
    });
    await audit({
      actorId,
      action: 'official_trader.resume',
      targetResource: 'official_trader_settings',
      targetId: provider.settings_id,
      reason: reason || 'Administrator resumed the official trader',
      after: { status: 'enabled', resumedPauses: active.rows.map((row) => row.id) },
    });
    return { status: 'enabled', resumed: active.rows.length };
  }

  async function loadCounts(providerId) {
    const [analyses, executions, research] = await Promise.all([
      queries.countByStatus(providerId, 'official_trader_analyses'),
      queries.countByStatus(providerId, 'official_trader_executions'),
      db.query(
        `SELECT count(*)::int AS total FROM official_trader_research_runs WHERE provider_id = $1`,
        [providerId],
      ),
    ]);
    return {
      analyses,
      executions,
      researchRuns: research.rows[0]?.total || 0,
    };
  }

  async function recordEvent(data) {
    try {
      return await queries.insertEvent(data);
    } catch (err) {
      logger.warn({ err, eventType: data.eventType }, 'Failed to record official trader event');
      return null;
    }
  }

  async function audit(params) {
    const adminAudit = getAudit();
    if (!adminAudit?.write) return null;
    try {
      return await adminAudit.write(params);
    } catch (err) {
      logger.warn({ err, action: params.action }, 'Failed to write official trader audit event');
      return null;
    }
  }

  async function safePublish(type, payload, actorId) {
    try {
      await events.emitNow(type, payload, { actorId });
    } catch (err) {
      logger.warn({ err, type }, 'Failed to emit official trader event');
    }
  }

  return {
    getOverview,
    updateSettings,
    listAvailableConnections,
    connectExchange,
    assignExistingConnection,
    updateConnection,
    removeConnection,
    getExchangeCatalog,
    emergencyPause,
    resume,
    recordEvent,
    publicSettings,
    publicProvider,
    publicAssignment,
  };
}

function normalizeSettingsPatch(fields) {
  const normalized = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (!SETTINGS_FIELDS.has(key) || value === undefined) continue;
    const column = COLUMN_MAP[key];
    if (key === 'researchTimeframes') {
      const timeframes = normalizeStringArray(value);
      if (!timeframes.every((timeframe) => ALLOWED_TIMEFRAMES.has(timeframe))) {
        throw new ValidationError('Unsupported research timeframe');
      }
      normalized[column] = timeframes;
    } else if (key === 'allowedMarketTypes') {
      const marketTypes = normalizeStringArray(value);
      if (!marketTypes.every((marketType) => ALLOWED_MARKET_TYPES.has(marketType))) {
        throw new ValidationError('Allowed market types must be spot or futures');
      }
      normalized[column] = marketTypes;
    } else if (key === 'allowedStrategies') {
      normalized[column] = normalizeStringArray(value);
    } else if (key === 'researchIntervalMinutes') {
      const minutes = Number(value);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
        throw new ValidationError('Research interval must be between 5 and 1440 minutes');
      }
      normalized[column] = minutes;
    } else if (key === 'maxAnalysesPerRun' || key === 'maxOpenPositions' || key === 'maxSlippageBps') {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1 || number > 1000) {
        throw new ValidationError(`${key} must be a positive integer`);
      }
      normalized[column] = number;
    } else if (key === 'minConfidence') {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > 1) {
        throw new ValidationError('Minimum confidence must be between 0 and 1');
      }
      normalized[column] = number;
    } else if (key === 'tradingSchedule') {
      normalized[column] = value;
    } else if (typeof value === 'boolean') {
      normalized[column] = value;
    } else if (['maxRiskPerTradePct', 'maxOrderNotional', 'maxDailyExposure', 'maxLeverage', 'maxDailyLoss', 'maxDrawdownPct'].includes(key)) {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) {
        throw new ValidationError(`${key} must be a non-negative number`);
      }
      normalized[column] = value;
    } else {
      normalized[column] = value;
    }
  }
  return normalized;
}

function normalizeStringArray(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
}

export function publicSettings(settings) {
  return {
    status: settings.settings_status ?? settings.status,
    researchEnabled: settings.research_enabled,
    executionEnabled: settings.execution_enabled,
    researchIntervalMinutes: settings.research_interval_minutes,
    researchTimeframes: settings.research_timeframes || [],
    primaryTimeframe: settings.primary_timeframe,
    minConfidence: Number(settings.min_confidence),
    maxAnalysesPerRun: settings.max_analyses_per_run,
    allowedMarketTypes: settings.allowed_market_types || [],
    allowedStrategies: settings.allowed_strategies || [],
    maxRiskPerTradePct: Number(settings.max_risk_per_trade_pct),
    maxOrderNotional: Number(settings.max_order_notional),
    maxOpenPositions: settings.max_open_positions,
    maxDailyExposure: Number(settings.max_daily_exposure),
    maxLeverage: Number(settings.max_leverage),
    maxDailyLoss: Number(settings.max_daily_loss),
    maxDrawdownPct: Number(settings.max_drawdown_pct),
    maxSlippageBps: settings.max_slippage_bps,
    tradingSchedule: settings.trading_schedule,
    publicationMode: settings.publication_mode,
    requireStopLoss: settings.require_stop_loss,
    copyTradingEnabled: settings.copy_trading_enabled,
    lastResearchAt: settings.last_research_at,
    lastExecutionAt: settings.last_execution_at,
    lastReconciledAt: settings.last_reconciled_at,
  };
}

export function publicProvider(provider) {
  return {
    id: provider.id,
    userId: provider.user_id,
    workspaceId: provider.workspace_id,
    handle: provider.handle,
    displayName: provider.display_name,
    moderationState: provider.moderation_state,
    visibility: provider.visibility,
    platformOwned: provider.platform_owned,
    followerCount: provider.follower_count,
    signalCount: provider.signal_count,
  };
}

export function publicAssignment(row) {
  if (!row) return null;
  return {
    id: row.id,
    connectionId: row.connection_id,
    accountId: row.account_id,
    exchangeCode: row.exchange_code,
    environment: row.environment,
    label: row.label || row.connection_label,
    isDefault: row.is_default,
    status: row.status,
    allowedMarketTypes: row.allowed_market_types || [],
    allowedSymbols: row.allowed_symbols || [],
    limits: {
      maxOrderNotional: row.max_order_notional == null ? null : Number(row.max_order_notional),
      maxOpenPositions: row.max_open_positions,
      maxDailyExposure: row.max_daily_exposure == null ? null : Number(row.max_daily_exposure),
      maxLeverage: row.max_leverage == null ? null : Number(row.max_leverage),
      maxDailyLoss: row.max_daily_loss == null ? null : Number(row.max_daily_loss),
      maxDrawdownPct: row.max_drawdown_pct == null ? null : Number(row.max_drawdown_pct),
      maxSlippageBps: row.max_slippage_bps,
    },
    connectionStatus: row.connection_status,
    accountStatus: row.account_status,
    accountType: row.account_type,
    createdAt: row.created_at,
  };
}

export default createOfficialTraderSettingsService;
