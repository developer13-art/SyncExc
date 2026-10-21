/**
 * SyncExc Server — Source connection service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { decrypt, encrypt } from '../../lib/crypto.js';
import { createTelegramClient, toTelegramInputPeer } from './telegram-client.js';

export function createSourceConnectionService({
  db,
  queries,
  adapterRegistry,
  credentialVault,
  config,
  events,
  logger,
  telegramClientFactory = createTelegramClient,
}) {
  async function authorize({ userId, workspaceId, sourceId, credentials }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Source');

    const adapter = adapterRegistry.get(source.type);
    if (!adapter) throw new NotFoundError(`Adapter for ${source.type}`);

    // Test the connection with the provided credentials
    let connection;
    try {
      connection = await adapter.authorize({
        source,
        credentials,
        userId,
      });
    } catch (err) {
      logger.warn({ err, sourceId }, 'Adapter authorization failed');
      throw new ConflictError(`Authorization failed: ${err.message}`, 'AUTHORIZATION_FAILED');
    }

    return db.tx(async (tx) => {
      // Encrypt credentials for storage
      if (credentials) {
        const encrypted = encrypt(JSON.stringify(credentials));
        const conn = await queries.findSourceConnection(sourceId);
        if (conn) {
          await queries.revokeSourceCredentials(tx, conn.id);
          await queries.insertSourceCredential(tx, {
            connectionId: conn.id,
            credentialType: source.type,
            encryptedValue: encrypted,
          });
        }
      }

      // Update connection status
      const conn = await queries.findSourceConnection(sourceId);
      if (conn) {
        await queries.updateSourceConnection(conn.id, {
          status: 'active',
          authorizationStatus: 'authorized',
          lastValidatedAt: new Date(),
          metadata: connection.metadata,
        }, tx);
      }

      await events.publish(
        tx,
        'source.connected',
        { sourceId, adapterType: source.type },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'signal_source',
          resourceId: sourceId,
        }
      );

      return { ok: true, connection: connection.metadata };
    });
  }

  async function testConnection({ userId, workspaceId, sourceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Source');

    const connection = await queries.findSourceConnection(sourceId);
    const adapter = adapterRegistry.get(source.type);
    if (!adapter) throw new NotFoundError(`Adapter for ${source.type}`);
    const credential = connection
      ? await queries.findActiveCredentialForConnection(connection.id)
      : null;
    const credentials = credential ? JSON.parse(decrypt(credential.encrypted_value)) : null;

    try {
      const result = await adapter.testConnection({ source, connection, credentials });
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function disconnect({ userId, workspaceId, sourceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Source');

    const conn = await queries.findSourceConnection(sourceId);

    return db.tx(async (tx) => {
      if (conn) {
        await queries.updateSourceConnection(conn.id, {
          status: 'revoked',
        }, tx);
        await queries.revokeSourceCredentials(tx, conn.id);
      }
      await tx.query(
        `UPDATE signal_sources SET monitoring_enabled = false, monitoring_started_at = NULL, updated_at = now() WHERE id = $1`,
        [sourceId]
      );
      await events.publish(
        tx,
        'source.disconnected',
        { sourceId },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'signal_source',
          resourceId: sourceId,
        }
      );

      return { ok: true };
    });
  }

  async function getConnection({ workspaceId, sourceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Source');
    const connection = await queries.findSourceConnection(sourceId);
    if (!connection) return null;
    const credential = await queries.findActiveCredentialForConnection(connection.id);
    return {
      id: connection.id,
      method: source.type,
      status: connection.status,
      authorizationStatus: connection.authorization_status,
      lastValidatedAt: connection.last_validated_at,
      credentialStatus: credential ? 'stored' : 'missing',
      metadata: {
        connectionType: connection.metadata?.connectionType ?? null,
        accountName: connection.metadata?.accountName ?? null,
        selectedSource: connection.metadata?.selectedSource ?? null,
      },
    };
  }

  async function listTelegramMessages({ workspaceId, sourceId, limit = 8 }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId || source.type !== 'telegram') {
      throw new NotFoundError('Telegram source');
    }
    const connection = await queries.findSourceConnection(sourceId);
    if (
      !connection ||
      connection.status !== 'active' ||
      connection.authorization_status !== 'authorized'
    ) {
      throw new ConflictError('Reconnect this Telegram source to view its messages', 'TELEGRAM_AUTH_REQUIRED');
    }
    const credential = await queries.findActiveCredentialForConnection(connection.id);
    if (!credential) {
      throw new ConflictError('Reconnect this Telegram source to view its messages', 'TELEGRAM_AUTH_REQUIRED');
    }
    const credentials = JSON.parse(decrypt(credential.encrypted_value));
    if (!credentials.sessionString || !credentials.selectedPeer) {
      throw new ConflictError('Reconnect this Telegram source to view its messages', 'TELEGRAM_AUTH_REQUIRED');
    }

    const client = telegramClientFactory(credentials.sessionString, config);
    try {
      await client.connect();
      if (!(await client.checkAuthorization())) {
        throw new ConflictError('Telegram authorization expired. Reconnect this source.', 'TELEGRAM_AUTH_REQUIRED');
      }
      const messages = await client.getMessages(
        toTelegramInputPeer(credentials.selectedPeer),
        { limit: Math.max(1, Math.min(50, Number(limit) || 8)) },
      );
      return messages.map((message) => ({
        id: String(message.id),
        content: message.message || message.text || message.caption || '',
        timestamp:
          message.date instanceof Date
            ? message.date
            : new Date(Number(message.date) * 1000),
      }));
    } finally {
      await client.disconnect().catch(() => {});
    }
  }

  return {
    authorize,
    testConnection,
    disconnect,
    getConnection,
    listTelegramMessages,
  };
}

export default createSourceConnectionService;