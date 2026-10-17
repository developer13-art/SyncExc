/**
 * SyncExc Server — Source registry service
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

export function createSourceRegistryService({ db, queries, events, audit, logger }) {
  async function registerSource({
    userId,
    workspaceId,
    type,
    name,
    identifier,
    url,
    providerName,
    marketCoverage,
    exchangeCoverage,
    assetCoverage,
    primaryLanguage,
    categories,
    accessMethod,
  }) {
    if (!name || !type || !identifier) {
      throw new ValidationError('name, type, and identifier are required');
    }

    const validTypes = ['telegram', 'discord', 'whatsapp', 'webhook', 'website', 'rest_api', 'email'];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`Unsupported source type: ${type}`);
    }

    const source = await db.tx(async (tx) => {
      const created = await queries.insertSource(tx, {
        workspaceId,
        ownerId: userId,
        type,
        name,
        url,
        providerName,
      });

      // Identifier
      await queries.insertIdentifier(tx, {
        sourceId: created.id,
        identifierType: `${type}_identifier`,
        value: identifier,
        canonical: true,
      });

      // Snapshot version 1
      await queries.insertSourceVersion(tx, {
        sourceId: created.id,
        version: 1,
        snapshot: created,
      });

      // Categories
      if (categories && categories.length > 0) {
        for (const code of categories) {
          const cat = await queries.findCategoryByCode('primary', code);
          if (cat) {
            await queries.assignCategory(tx, {
              sourceId: created.id,
              categoryId: cat.id,
              provenance: 'user_provided',
            });
          }
        }
      }

      // Connection
      await queries.insertSourceConnection(tx, {
        sourceId: created.id,
        adapterType: type,
        status: 'pending',
      });

      // Audit
      await queries.insertAuditEvent(tx, {
        sourceId: created.id,
        actorId: userId,
        action: 'source.registered',
        resourceType: 'signal_source',
        resourceId: created.id,
        after: { name, type },
      });

      // Emit
      await events.publish(
        tx,
        'source.registered',
        { sourceId: created.id, type, name },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'signal_source',
          resourceId: created.id,
        }
      );

      return created;
    });

    return source;
  }

  async function getSource(sourceId) {
    return queries.findSourceById(sourceId);
  }

  async function getSourceForWorkspace({ sourceId, workspaceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source) throw new NotFoundError('Source');
    if (source.workspace_id !== workspaceId) {
      // Check if it's shared with this workspace
      const shares = await queries.listSharesForSource(sourceId);
      const hasAccess = shares.some((s) => s.shared_with_workspace_id === workspaceId);
      if (!hasAccess) throw new NotFoundError('Source');
    }
    return source;
  }

  async function listSources({ workspaceId, status, type }) {
    return queries.listSourcesForWorkspace(workspaceId, { status, type });
  }

  async function getActiveSourcesForWorkspace(workspaceId) {
    return queries.listActiveSourcesForWorkspace(workspaceId);
  }

  async function updateSource({ userId, workspaceId, sourceId, updates }) {
    await getSourceForWorkspace({ sourceId, workspaceId });

    return db.tx(async (tx) => {
      const updated = await queries.updateSource(sourceId, updates);

      await queries.insertSourceVersion(tx, {
        sourceId,
        version: updated.current_version + 1,
        snapshot: updated,
      });

      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: 'source.updated',
        resourceType: 'signal_source',
        resourceId: sourceId,
        after: updates,
      });

      return updated;
    });
  }

  async function activateSource({ userId, workspaceId, sourceId }) {
    const source = await getSourceForWorkspace({ sourceId, workspaceId });

    if (!['draft', 'approved', 'pending_validation', 'paused'].includes(source.status)) {
      throw new ConflictError(
        `Source cannot be activated from status ${source.status}`,
        'INVALID_STATUS'
      );
    }
    const connection = await queries.findSourceConnection(sourceId);
    if (connection?.status !== 'active' || connection.authorization_status !== 'authorized') {
      throw new ConflictError('Authorize and test the source connection before enabling it', 'CONNECTION_REQUIRED');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateSourceStatus(sourceId, 'active');
      await db.query(
        `UPDATE signal_sources SET monitoring_enabled = false WHERE id = $1`,
        [sourceId]
      );

      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: 'source.activated',
        resourceType: 'signal_source',
        resourceId: sourceId,
      });

      await events.publish(
        tx,
        'source.activated',
        { sourceId },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'signal_source',
          resourceId: sourceId,
        }
      );

      return updated;
    });
  }

  async function pauseSource({ userId, workspaceId, sourceId, reason }) {
    const source = await getSourceForWorkspace({ sourceId, workspaceId });
    if (source.status !== 'active') {
      throw new ConflictError('Source is not active', 'NOT_ACTIVE');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateSourceStatus(sourceId, 'paused');

      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: 'source.paused',
        resourceType: 'signal_source',
        resourceId: sourceId,
        after: { reason },
      });

      await events.publish(
        tx,
        'source.paused',
        { sourceId, reason },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'signal_source',
          resourceId: sourceId,
        }
      );

      return updated;
    });
  }

  async function archiveSource({ userId, workspaceId, sourceId }) {
    await getSourceForWorkspace({ sourceId, workspaceId });

    return db.tx(async (tx) => {
      const updated = await queries.updateSourceStatus(sourceId, 'archived', new Date());

      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: 'source.archived',
        resourceType: 'signal_source',
        resourceId: sourceId,
      });

      return updated;
    });
  }

  async function setMonitoring({ userId, workspaceId, sourceId, enabled }) {
    const source = await getSourceForWorkspace({ sourceId, workspaceId });
    if (source.workspace_id !== workspaceId) throw new NotFoundError('Source');

    if (enabled) {
      if (source.status !== 'active') {
        throw new ConflictError('Enable the source before starting monitoring', 'SOURCE_NOT_ACTIVE');
      }
      const connection = await queries.findSourceConnection(sourceId);
      if (connection?.status !== 'active' || connection.authorization_status !== 'authorized') {
        throw new ConflictError('An authorized connection is required for monitoring', 'CONNECTION_REQUIRED');
      }
    }

    let updated;
    await db.tx(async (tx) => {
      const result = await tx.query(
        `
        UPDATE signal_sources
        SET monitoring_enabled = $2,
            monitoring_started_at = CASE WHEN $2 THEN COALESCE(monitoring_started_at, now()) ELSE NULL END,
            updated_at = now()
        WHERE id = $1 AND workspace_id = $3
        RETURNING *
        `,
        [sourceId, enabled, workspaceId]
      );
      updated = result.rows[0];
      if (!updated) throw new NotFoundError('Source');

      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: enabled ? 'source.monitoring_enabled' : 'source.monitoring_disabled',
        resourceType: 'signal_source',
        resourceId: sourceId,
        after: { monitoringEnabled: enabled },
      });
    });
    return updated;
  }

  async function getExecutionConfig({ workspaceId, sourceId }) {
    const source = await getSourceForWorkspace({ sourceId, workspaceId });
    if (source.workspace_id !== workspaceId) throw new NotFoundError('Source');
    const [configResult, destinationResult, availableResult] = await Promise.all([
      db.query(
        `SELECT * FROM signal_source_execution_configs WHERE source_id = $1 AND workspace_id = $2 ORDER BY version DESC LIMIT 1`,
        [sourceId, workspaceId]
      ),
      db.query(
        `
        SELECT a.id AS account_id, a.account_type, a.status,
               c.exchange_code, c.environment, c.label
        FROM exchange_accounts a
        JOIN exchange_connections c ON c.id = a.connection_id
        WHERE c.workspace_id = $1 AND c.status = 'active' AND a.status = 'active'
        ORDER BY c.label, a.account_type
        `,
        [workspaceId]
      ),
      db.query(
        `
        SELECT d.account_id, d.enabled, a.account_type, a.status,
               c.exchange_code, c.environment, c.status AS connection_status, c.label
        FROM signal_source_destinations d
        JOIN exchange_accounts a ON a.id = d.account_id
        JOIN exchange_connections c ON c.id = a.connection_id
        WHERE d.source_id = $1 AND d.workspace_id = $2
        ORDER BY c.label, a.account_type
        `,
        [sourceId, workspaceId]
      ),
    ]);
    const row = configResult.rows[0];
    return {
      version: row?.version ?? source.execution_config_version ?? 1,
      mode: row?.mode ?? 'review',
      settings: row?.settings ?? source.execution_settings ?? {},
      destinations: destinationResult.rows,
      availableDestinations: availableResult.rows,
    };
  }

  async function updateExecutionConfig({
    userId,
    workspaceId,
    sourceId,
    mode,
    settings = {},
    destinationAccountIds = [],
  }) {
    const source = await getSourceForWorkspace({ sourceId, workspaceId });
    if (source.workspace_id !== workspaceId) throw new NotFoundError('Source');
    if (!['monitor_only', 'review', 'simulate', 'live'].includes(mode)) {
      throw new ValidationError('Unsupported execution mode');
    }
    if (!Array.isArray(destinationAccountIds) || destinationAccountIds.length > 10) {
      throw new ValidationError('Choose no more than 10 destination accounts');
    }
    const accountIds = [...new Set(destinationAccountIds)];
    if (accountIds.length !== destinationAccountIds.length) {
      throw new ValidationError('Destination accounts must be unique');
    }

    const accountResult = accountIds.length
      ? await db.query(
        `
        SELECT a.id, a.account_type, a.status, c.status AS connection_status, c.environment
        FROM exchange_accounts a
        JOIN exchange_connections c ON c.id = a.connection_id
        WHERE a.id = ANY($1::uuid[]) AND c.workspace_id = $2
        `,
        [accountIds, workspaceId]
      )
      : { rows: [] };
    if (accountResult.rows.length !== accountIds.length) {
      throw new ValidationError('Every destination account must belong to the active workspace');
    }
    if (accountResult.rows.some((account) => account.status !== 'active' || account.connection_status !== 'active')) {
      throw new ConflictError('All destination accounts must be active', 'DESTINATION_INACTIVE');
    }
    if (['monitor_only', 'simulate'].includes(mode) && accountIds.length > 0) {
      throw new ValidationError('Monitoring and simulation modes cannot target exchange accounts');
    }
    if (mode === 'live' && accountResult.rows.some((account) => account.environment !== 'live')) {
      throw new ValidationError('Live mode requires live exchange accounts; testnet accounts are not eligible');
    }
    if (mode === 'live' && accountIds.length === 0) {
      throw new ValidationError('Live mode requires at least one explicitly selected destination');
    }
    if (mode === 'live') {
      const riskPerTradePct = Number(settings.riskPerTradePct);
      const maxLeverage = Number(settings.maxLeverage);
      if (!Number.isFinite(riskPerTradePct) || riskPerTradePct <= 0 || riskPerTradePct > 5) {
        throw new ValidationError('Live mode requires riskPerTradePct between 0 and 5');
      }
      if (!Number.isInteger(maxLeverage) || maxLeverage < 1 || maxLeverage > 20) {
        throw new ValidationError('Live mode requires maxLeverage between 1 and 20');
      }
      if (settings.allowedSymbols != null &&
          (!Array.isArray(settings.allowedSymbols) || settings.allowedSymbols.length > 50 ||
            settings.allowedSymbols.some((symbol) => typeof symbol !== 'string' ||
              !/^[A-Z0-9._-]{2,24}$/.test(symbol)))) {
        throw new ValidationError('Allowed symbols must be a list of up to 50 valid market symbols');
      }
    }

    let version;
    await db.tx(async (tx) => {
      await tx.query(
        `SELECT id FROM signal_sources WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [sourceId, workspaceId]
      );
      const latest = await tx.query(
        `SELECT COALESCE(MAX(version), 0)::int AS version FROM signal_source_execution_configs WHERE source_id = $1 AND workspace_id = $2`,
        [sourceId, workspaceId]
      );
      version = latest.rows[0].version + 1;
      await tx.query(
        `
        INSERT INTO signal_source_execution_configs
          (source_id, workspace_id, version, mode, settings, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [sourceId, workspaceId, version, mode, JSON.stringify(settings), userId]
      );
      await tx.query(
        `DELETE FROM signal_source_destinations WHERE source_id = $1 AND workspace_id = $2`,
        [sourceId, workspaceId]
      );
      for (const accountId of accountIds) {
        await tx.query(
          `
          INSERT INTO signal_source_destinations
            (source_id, workspace_id, account_id, enabled, created_by)
          VALUES ($1, $2, $3, true, $4)
          `,
          [sourceId, workspaceId, accountId, userId]
        );
      }
      await tx.query(
        `
        UPDATE signal_sources
        SET execution_config_version = $3, execution_settings = $4, updated_at = now()
        WHERE id = $1 AND workspace_id = $2
        `,
        [sourceId, workspaceId, version, JSON.stringify(settings)]
      );
      await queries.insertAuditEvent(tx, {
        sourceId,
        actorId: userId,
        action: 'source.execution_config_updated',
        resourceType: 'signal_source',
        resourceId: sourceId,
        after: { version, mode, destinationAccountIds: accountIds },
      });
    });
    return getExecutionConfig({ workspaceId, sourceId });
  }

  return {
    registerSource,
    getSource,
    getSourceForWorkspace,
    listSources,
    getActiveSourcesForWorkspace,
    updateSource,
    activateSource,
    pauseSource,
    archiveSource,
    setMonitoring,
    getExecutionConfig,
    updateExecutionConfig,
  };
}

export default createSourceRegistryService;