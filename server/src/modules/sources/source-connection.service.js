/**
 * SyncExc Server — Source connection service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';
import { decrypt, encrypt } from '../../lib/crypto.js';

export function createSourceConnectionService({
  db,
  queries,
  adapterRegistry,
  credentialVault,
  events,
  logger,
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
      await tx.query(
        `
        UPDATE trading_execution_destination_results r
        SET status = CASE
          WHEN r.status = 'pending' THEN 'cancelled'
          WHEN r.status = 'submitted' THEN 'uncertain'
          ELSE r.status
        END,
        completed_at = CASE WHEN r.status = 'pending' THEN now() ELSE r.completed_at END
        WHERE r.intent_id IN (
          SELECT i.id
          FROM trading_execution_intents i
          JOIN trading_signal_candidates c ON c.id = i.signal_id
          WHERE c.source_id = $1 AND i.workspace_id = $2
        )
          AND r.status IN ('pending', 'submitted')
        `,
        [sourceId, workspaceId]
      );
      await tx.query(
        `
        UPDATE trading_execution_intents i
        SET status = 'canceled', completed_at = now()
        WHERE i.status IN ('created', 'held')
          AND i.workspace_id = $2
          AND i.signal_id IN (
            SELECT c.id FROM trading_signal_candidates c WHERE c.source_id = $1
          )
        `,
        [sourceId, workspaceId]
      );
      await tx.query(
        `
        INSERT INTO trading_execution_intent_events (intent_id, event_type, actor_id, metadata)
        SELECT i.id, 'source_disconnected', $3, jsonb_build_object('sourceId', $1, 'workspaceId', $2)
        FROM trading_execution_intents i
        JOIN trading_signal_candidates c ON c.id = i.signal_id
        WHERE c.source_id = $1 AND i.workspace_id = $2 AND i.status = 'dispatched'
        `,
        [sourceId, workspaceId, userId]
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
        botId: connection.metadata?.botId ?? null,
        botUsername: connection.metadata?.botUsername ?? null,
        chatId: connection.metadata?.chatId ?? null,
        chatTitle: connection.metadata?.chatTitle ?? null,
      },
    };
  }

  return {
    authorize,
    testConnection,
    disconnect,
    getConnection,
  };
}

export default createSourceConnectionService;