/**
 * SyncExc Server — Connections service
 *
 * Orchestrates connections, credential validation, account discovery,
 * balance sync, instrument sync, health tracking.
 */

import { AppError, ValidationError, ConflictError, NotFoundError, AuthorizationError } from '../../lib/errors.js';
import { CONNECTION_STATUS } from '@syncexc/shared';

export function createConnectionsService({
  db,
  queries,
  rateLimiter,
  credentialVault,
  adapterRegistry,
  rateLimitCoordinator,
  events,
  audit,
  logger,
}) {
  /* ===========================================================================
   * READ HELPERS
   * ======================================================================== */

  async function getConnection(connectionId) {
    return queries.findConnectionById(connectionId);
  }

  async function getActiveConnectionForAccount(accountId) {
    const account = await queries.findAccountById(accountId);
    if (!account) return null;
    const connection = await queries.findConnectionById(account.connection_id);
    return connection;
  }

  async function getAdapter(exchangeCode) {
    const adapter = adapterRegistry.get(exchangeCode);
    if (!adapter) throw new NotFoundError(`Exchange ${exchangeCode}`);
    return adapter;
  }

  async function getInstrument({ exchangeCode, symbol }) {
    return queries.findInstrument(exchangeCode, symbol);
  }

  async function loadCredentials(connectionId) {
    const record = await queries.findActiveCredentialForConnection(connectionId);
    if (!record) throw new NotFoundError('Credentials');
    return credentialVault.decryptCredentials(record);
  }

  async function checkAccountAccess({ accountId, workspaceId, operation }) {
    const account = await queries.findAccountById(accountId);
    if (!account) throw new NotFoundError('Account');

    const connection = await queries.findConnectionById(account.connection_id);
    if (!connection) throw new NotFoundError('Connection');

    // Direct ownership
    if (connection.workspace_id === workspaceId) {
      return { hasAccess: true, scope: 'owner' };
    }

    // Shared access
    const grants = await db.query(
      `
      SELECT allowed_operations FROM connection_sharing_grants
      WHERE connection_id = $1
        AND recipient_workspace_id = $2
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
      `,
      [connection.id, workspaceId]
    );

    if (grants.rows.length === 0) {
      throw new AuthorizationError('No access to this connection', 'NO_CONNECTION_ACCESS');
    }

    const allowed = grants.rows[0].allowed_operations || [];
    if (operation && !allowed.includes(operation)) {
      throw new AuthorizationError(`Operation not permitted: ${operation}`, 'OPERATION_NOT_PERMITTED');
    }

    return { hasAccess: true, scope: 'shared', allowedOperations: allowed };
  }

  async function requireConnectionAccess({
    connectionId,
    workspaceId,
    operation = 'view_status',
    allowShared = true,
  }) {
    const connection = await queries.findConnectionById(connectionId);
    if (!connection) throw new NotFoundError('Connection');
    if (connection.workspace_id === workspaceId) return connection;

    if (allowShared) {
      const grant = await db.query(
        `
        SELECT allowed_operations
        FROM connection_sharing_grants
        WHERE connection_id = $1
          AND recipient_workspace_id = $2
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
        LIMIT 1
        `,
        [connectionId, workspaceId]
      );
      const allowed = grant.rows[0]?.allowed_operations || [];
      if (allowed.includes(operation)) return connection;
    }

    // Do not disclose whether an inaccessible connection exists.
    throw new NotFoundError('Connection');
  }

  async function requireAccountAccess({ accountId, workspaceId, operation = 'view_balances' }) {
    const account = await queries.findAccountById(accountId);
    if (!account) throw new NotFoundError('Account');
    await requireConnectionAccess({
      connectionId: account.connection_id,
      workspaceId,
      operation,
    });
    return account;
  }

  async function requireVerifiedPermission({ connectionId, permissionKey }) {
    const permissions = await queries.listConnectionPermissions(connectionId);
    const permission = permissions.find((item) => item.permission_key === permissionKey);
    if (permission?.verification !== 'verified') {
      throw new ConflictError(
        permission?.verification === 'missing_permission'
          ? `Exchange connection is missing the ${permissionKey} permission`
          : `The ${permissionKey} permission could not be verified`,
        permission?.verification === 'missing_permission'
          ? 'EXCHANGE_PERMISSION_MISSING'
          : 'EXCHANGE_PERMISSION_UNVERIFIED'
      );
    }
    return permission;
  }

  /* ===========================================================================
   * CONNECTION MANAGEMENT
   * ======================================================================== */

  async function createConnection({ userId, workspaceId, exchange, environment, label, credentials }) {
    const exchangeRecord = await queries.findExchangeByCode(exchange);
    if (!exchangeRecord || exchangeRecord.integration_status === 'disabled') {
      throw new ValidationError(`Exchange not available: ${exchange}`);
    }

    const adapter = adapterRegistry.get(exchange);
    if (!adapter) throw new ValidationError(`Exchange adapter not available: ${exchange}`);

    // Validate credentials before persisting
    let validationResult;
    try {
      validationResult = await adapter.validateCredentials({ ...credentials, environment });
    } catch (err) {
      logger.warn({ err, exchange }, 'Credential validation failed');
      throw new ValidationError('Exchange credentials are invalid or lack required permissions');
    }

    if (validationResult.canWithdraw) {
      logger.warn({ exchange, userId }, 'Rejecting API key with withdrawal permission');
      throw new ValidationError(
        'API key has withdrawal permission. Please disable withdrawals on the exchange and create a new key.',
        'WITHDRAWAL_PERMISSION_ENABLED'
      );
    }
    if (!validationResult.canRead) {
      throw new ValidationError(
        'The exchange key must have verified read access to connect an account.',
        'READ_PERMISSION_REQUIRED'
      );
    }

    const encrypted = credentialVault.encryptCredentials(credentials);

    return db.tx(async (tx) => {
      const connection = await queries.insertConnection(tx, {
        workspaceId,
        ownerId: userId,
        exchangeCode: exchange,
        environment: environment || 'live',
        label,
        status: 'validating',
        capabilities: adapter.capabilities,
      });

      await queries.insertCredential(tx, {
        connectionId: connection.id,
        apiKeyEncrypted: encrypted.apiKeyEncrypted,
        apiSecretEncrypted: encrypted.apiSecretEncrypted,
        passphraseEncrypted: encrypted.passphraseEncrypted,
        keyVersion: encrypted.keyVersion,
      });

      await queries.upsertConnectionPermission({
        connectionId: connection.id,
        permissionKey: 'account.read',
        verification: validationResult.canRead ? 'verified' : 'missing_permission',
      });

      await queries.upsertConnectionPermission({
        connectionId: connection.id,
        permissionKey: 'trading',
        verification: validationResult.canTrade ? 'verified' : 'missing_permission',
      });

      await events.publish(
        tx,
        'connection.created',
        { connectionId: connection.id, exchange, environment: environment || 'live' },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'exchange_connection',
          resourceId: connection.id,
        }
      );

      return connection;
    }).then(async (connection) => {
      // Keep the connection out of the healthy/active state until account
      // discovery has completed. Partial market or balance sync is visible as
      // degraded rather than being presented as a healthy connection.
      try {
        await discoverAccountsAndSync(connection, credentials, adapter);
      } catch (err) {
        logger.warn(
          { errorName: err?.name || 'Error', connectionId: connection.id },
          'Post-create exchange sync failed'
        );
        await queries.updateConnection(connection.id, { status: 'degraded' });
        await queries.upsertHealth({
          connectionId: connection.id,
          state: 'degraded',
          lastError: 'Initial account synchronization failed. Test or reconnect this exchange.',
          dataFreshness: 'stale',
        });
        return { ...connection, status: 'degraded' };
      }

      const activeConnection = await queries.updateConnection(connection.id, {
        status: 'active',
        lastValidatedAt: new Date(),
      });
      return activeConnection || { ...connection, status: 'active' };
    });
  }

  async function discoverAccountsAndSync(connection, credentials, adapter) {
    const accounts = await adapter.discoverAccounts(credentials);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error('Exchange did not return any discoverable accounts');
    }
    for (const acc of accounts) {
      await db.tx(async (tx) => {
        const account = await queries.insertAccount(tx, {
          connectionId: connection.id,
          exchangeAccountId: acc.exchangeAccountId,
          accountType: acc.accountType,
          status: 'active',
          supportedCapabilities: [],
        });

        // Sync balances
        try {
          const balances = await adapter.fetchBalances({
            ...credentials,
            accountType: acc.accountType,
            environment: connection.environment,
          });
          const snapshot = await queries.insertBalanceSnapshot(tx, {
            accountId: account.id,
            observedAt: new Date(),
          });
          for (const b of balances) {
            await queries.insertBalanceItem(tx, {
              snapshotId: snapshot.id,
              asset: b.asset,
              free: b.free,
              used: b.used,
              total: b.total,
            });
          }
        } catch (err) {
          logger.error(
            {
              errorName: err?.name || 'Error',
              connectionId: connection.id,
              accountType: acc.accountType,
            },
            'Balance sync failed during account discovery'
          );
          throw err;
        }
      });
    }

    // Sync instruments
    try {
      const instruments = await adapter.fetchInstruments({ marketType: 'spot' });
      for (const inst of instruments) {
        await queries.upsertInstrument(null, {
          exchangeCode: connection.exchange_code,
          ...inst,
        });
      }
    } catch (err) {
      logger.warn(
        { errorName: err?.name || 'Error', connectionId: connection.id },
        'Instrument sync failed'
      );
      throw err;
    }

    await queries.upsertHealth({
      connectionId: connection.id,
      state: 'healthy',
      lastSuccessfulRequest: new Date(),
      lastSuccessfulSync: new Date(),
      dataFreshness: 'current',
    });
  }

  async function testConnection({ userId, workspaceId, connectionId }) {
    const connection = await requireConnectionAccess({
      connectionId,
      workspaceId,
      operation: 'view_status',
    });

    const credentials = await loadCredentials(connectionId);
    const adapter = adapterRegistry.get(connection.exchange_code);
    if (!adapter) throw new NotFoundError('Adapter');

    try {
      const result = await adapter.validateCredentials({
        ...credentials,
        environment: connection.environment,
      });
      await queries.upsertHealth({
        connectionId,
        state: 'healthy',
        lastSuccessfulRequest: new Date(),
        dataFreshness: 'current',
      });
      return { ok: true, ...result };
    } catch (err) {
      logger.warn(
        { errorName: err?.name || 'Error', connectionId },
        'Exchange connection test failed'
      );
      await queries.upsertHealth({
        connectionId,
        state: 'unavailable',
        lastError: 'Exchange test failed. Check credentials, permissions, and exchange availability.',
      });
      return {
        ok: false,
        error: 'Exchange test failed. Check credentials, permissions, and exchange availability.',
      };
    }
  }

  async function rotateCredentials({ userId, workspaceId, connectionId, credentials, reason }) {
    const connection = await requireConnectionAccess({
      connectionId,
      workspaceId,
      allowShared: false,
    });

    const adapter = adapterRegistry.get(connection.exchange_code);
    const validation = await adapter.validateCredentials({
      ...credentials,
      environment: connection.environment,
    });
    if (!validation.canRead) {
      throw new ValidationError('New credentials lack read permission');
    }
    if (validation.canWithdraw) {
      throw new ValidationError('New credentials have withdrawal permission enabled');
    }

    const encrypted = credentialVault.encryptCredentials(credentials);
    const previous = await queries.findActiveCredentialForConnection(connectionId);

    return db.tx(async (tx) => {
      if (previous) {
        await queries.markCredentialRevoked(previous.id);
      }

      const newCred = await queries.insertCredential(tx, {
        connectionId,
        apiKeyEncrypted: encrypted.apiKeyEncrypted,
        apiSecretEncrypted: encrypted.apiSecretEncrypted,
        passphraseEncrypted: encrypted.passphraseEncrypted,
        keyVersion: encrypted.keyVersion,
      });

      await queries.upsertConnectionPermission({
        connectionId,
        permissionKey: 'account.read',
        verification: validation.canRead ? 'verified' : 'missing_permission',
      });
      await queries.upsertConnectionPermission({
        connectionId,
        permissionKey: 'trading',
        verification: validation.canTrade ? 'verified' : 'missing_permission',
      });

      await queries.insertCredentialRotation(tx, {
        connectionId,
        previousCredentialId: previous?.id || null,
        newCredentialId: newCred.id,
        rotatedBy: userId,
        reason,
      });

      await events.publish(
        tx,
        'connection.credential_rotated',
        { connectionId },
        {
          actorId: userId,
          workspaceId: connection.workspace_id,
          resourceType: 'exchange_connection',
          resourceId: connectionId,
        }
      );

      return newCred;
    });
  }

  async function suspendConnection({ userId, workspaceId, connectionId, reason }) {
    const connection = await requireConnectionAccess({
      connectionId,
      workspaceId,
      allowShared: false,
    });

    return db.tx(async (tx) => {
      await tx.query(
        `UPDATE exchange_connections SET status = 'suspended', updated_at = now() WHERE id = $1`,
        [connectionId]
      );

      await queries.insertConnectionEvent({
        connectionId,
        eventType: 'connection.suspended',
        actorId: userId,
        metadata: { reason },
      });

      await events.publish(
        tx,
        'connection.suspended',
        { connectionId, reason },
        {
          actorId: userId,
          workspaceId: connection.workspace_id,
          resourceType: 'exchange_connection',
          resourceId: connectionId,
        }
      );

      return { ok: true };
    });
  }

  async function disconnectConnection({ userId, workspaceId, connectionId }) {
    const connection = await requireConnectionAccess({
      connectionId,
      workspaceId,
      allowShared: false,
    });

    const credential = await queries.findActiveCredentialForConnection(connectionId);

    return db.tx(async (tx) => {
      if (credential) {
        await queries.markCredentialRevoked(credential.id);
      }

      await queries.markConnectionDisconnected(connectionId);

      await events.publish(
        tx,
        'connection.disconnected',
        { connectionId },
        {
          actorId: userId,
          workspaceId: connection.workspace_id,
          resourceType: 'exchange_connection',
          resourceId: connectionId,
        }
      );

      return { ok: true };
    });
  }

  async function listConnections({ userId, workspaceId }) {
    const connections = await queries.listConnectionsForWorkspace(workspaceId, { includeShared: true });
    return Promise.all(connections.map(async (connection) => {
      const [accounts, health, exchange] = await Promise.all([
        connection.is_shared && !connection.allowed_operations?.includes('view_balances')
          ? Promise.resolve([])
          : queries.listAccountsForConnection(connection.id),
        queries.getHealth(connection.id),
        queries.findExchangeByCode(connection.exchange_code),
      ]);
      return {
        ...connection,
        accounts,
        account_count: accounts.length,
        exchange_name: exchange?.display_name || connection.exchange_code,
        health: health
          ? {
              status: health.state,
              lastSuccessfulSync: health.last_successful_sync,
              dataFreshness: health.data_freshness,
            }
          : null,
      };
    }));
  }

  async function listAccounts({ connectionId, workspaceId }) {
    await requireConnectionAccess({
      connectionId,
      workspaceId,
      operation: 'view_balances',
    });
    return queries.listAccountsForConnection(connectionId);
  }

  async function fetchBalances({ accountId, workspaceId }) {
    await requireAccountAccess({ accountId, workspaceId });
    const snapshot = await queries.getLatestBalanceSnapshot(accountId);
    if (!snapshot) return { items: [], observedAt: null, freshness: 'unknown' };
    const items = await queries.listBalanceItemsForSnapshot(snapshot.id);
    const observedAt = new Date(snapshot.observed_at);
    const freshness = Number.isNaN(observedAt.getTime())
      ? 'unknown'
      : Date.now() - observedAt.getTime() > 60_000
        ? 'stale'
        : 'current';
    return {
      observedAt: snapshot.observed_at,
      receivedAt: snapshot.received_at,
      freshness,
      items: items.map((i) => ({
        asset: i.asset,
        free: i.free,
        available: i.free,
        used: i.used,
        reserved: i.used,
        total: i.total,
        updatedAt: snapshot.observed_at,
      })),
    };
  }

  async function listInstruments({ exchangeCode, marketType }) {
    const rows = await queries.listInstrumentsForExchange(exchangeCode, { marketType });
    return rows;
  }

  async function getHealth({ connectionId, workspaceId }) {
    await requireConnectionAccess({ connectionId, workspaceId });
    return queries.getHealth(connectionId);
  }

  async function listPermissions({ connectionId, workspaceId }) {
    await requireConnectionAccess({ connectionId, workspaceId });
    return queries.listConnectionPermissions(connectionId);
  }

  /* ===========================================================================
   * EXPORTS
   * ======================================================================== */

  return {
    getConnection,
    requireConnectionAccess,
    requireAccountAccess,
    requireVerifiedPermission,
    getActiveConnectionForAccount,
    getAdapter,
    getInstrument,
    loadCredentials,
    checkAccountAccess,

    createConnection,
    testConnection,
    rotateCredentials,
    suspendConnection,
    disconnectConnection,
    listConnections,
    listAccounts,
    fetchBalances,
    listInstruments,
    getHealth,
    listPermissions,
  };
}

export default createConnectionsService;