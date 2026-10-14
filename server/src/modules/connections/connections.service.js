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
  redis,
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
      validationResult = await adapter.validateCredentials(credentials);
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
      // Outside the transaction: discover accounts, sync instruments, balances
      try {
        await discoverAccountsAndSync(connection, credentials, adapter);
      } catch (err) {
        logger.error({ err, connectionId: connection.id }, 'Post-create sync failed');
      }

      await queries.updateConnection(connection.id, { status: 'active', lastValidatedAt: new Date() });

      return connection;
    });
  }

  async function discoverAccountsAndSync(connection, credentials, adapter) {
    const accounts = await adapter.discoverAccounts(credentials);
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
            { err, connectionId: connection.id, accountType: acc.accountType },
            'Balance sync failed during account discovery'
          );
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
      logger.error({ err, connectionId: connection.id }, 'Instrument sync failed');
    }

    await queries.upsertHealth({
      connectionId: connection.id,
      state: 'healthy',
      lastSuccessfulRequest: new Date(),
      lastSuccessfulSync: new Date(),
      dataFreshness: 'current',
    });
  }

  async function testConnection({ userId, connectionId }) {
    const connection = await queries.findConnectionById(connectionId);
    if (!connection) throw new NotFoundError('Connection');

    const credentials = await loadCredentials(connectionId);
    const adapter = adapterRegistry.get(connection.exchange_code);
    if (!adapter) throw new NotFoundError('Adapter');

    try {
      const result = await adapter.validateCredentials(credentials);
      await queries.upsertHealth({
        connectionId,
        state: 'healthy',
        lastSuccessfulRequest: new Date(),
        dataFreshness: 'current',
      });
      return { ok: true, ...result };
    } catch (err) {
      await queries.upsertHealth({
        connectionId,
        state: 'unavailable',
        lastError: err.message,
      });
      return { ok: false, error: err.message };
    }
  }

  async function rotateCredentials({ userId, connectionId, credentials, reason }) {
    const connection = await queries.findConnectionById(connectionId);
    if (!connection) throw new NotFoundError('Connection');

    const adapter = adapterRegistry.get(connection.exchange_code);
    const validation = await adapter.validateCredentials(credentials);
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

  async function suspendConnection({ userId, connectionId, reason }) {
    const connection = await queries.findConnectionById(connectionId);
    if (!connection) throw new NotFoundError('Connection');

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

  async function disconnectConnection({ userId, connectionId }) {
    const connection = await queries.findConnectionById(connectionId);
    if (!connection) throw new NotFoundError('Connection');

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
    return queries.listConnectionsForWorkspace(workspaceId, { includeShared: true });
  }

  async function listAccounts({ connectionId }) {
    return queries.listAccountsForConnection(connectionId);
  }

  async function fetchBalances({ accountId }) {
    const snapshot = await queries.getLatestBalanceSnapshot(accountId);
    if (!snapshot) return { items: [], observedAt: null };
    const items = await queries.listBalanceItemsForSnapshot(snapshot.id);
    return {
      observedAt: snapshot.observed_at,
      items: items.map((i) => ({
        asset: i.asset,
        free: i.free,
        used: i.used,
        total: i.total,
      })),
    };
  }

  async function listInstruments({ exchangeCode, marketType }) {
    const rows = await queries.listInstrumentsForExchange(exchangeCode, { marketType });
    return rows;
  }

  async function getHealth({ connectionId }) {
    return queries.getHealth(connectionId);
  }

  /* ===========================================================================
   * EXPORTS
   * ======================================================================== */

  return {
    getConnection,
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
  };
}

export default createConnectionsService;