/**
 * SyncExc Server — Exchange stream manager
 *
 * Subscribes to exchange WebSocket streams for real-time order and position
 * updates. Each stream is scoped to a single connection; when the connection
 * is revoked or suspended, the stream is torn down.
 *
 * Adapters that don't yet support WebSocket are simply skipped.
 */

import { createLogger } from '../../lib/logger.js';

export function createExchangeStreams({ db, queries, adapterRegistry, events, realtime, logger }) {
  const log = logger || createLogger({ component: 'connections:streams' });

  const active = new Map(); // connectionId → stream handle

  function startStreamForConnection(connection) {
    if (active.has(connection.id)) return;

    const adapter = adapterRegistry.get(connection.exchange_code);
    if (!adapter?.subscribe) {
      log.debug(
        { connectionId: connection.id, exchange: connection.exchange_code },
        'Adapter does not support WebSocket subscriptions'
      );
      return;
    }

    log.info(
      { connectionId: connection.id, exchange: connection.exchange_code },
      'Starting exchange stream'
    );

    const handle = adapter.subscribe({
      connectionId: connection.id,
      onEvent: (envelope) => {
        // Publish to the outbox for durable processing
        db.tx(async (tx) => {
          await events.publish(tx, envelope.eventType, envelope.payload, {
            correlationId: envelope.correlationId,
            workspaceId: connection.workspace_id,
            resourceType: envelope.resourceType,
            resourceId: envelope.resourceId,
          });
        }).catch((err) => log.error({ err }, 'Failed to publish stream event'));

        // Also broadcast over WebSocket for immediate UI updates
        if (realtime) {
          realtime.broadcastToWorkspace(
            connection.workspace_id,
            envelope.eventType,
            envelope.payload,
            { resourceType: envelope.resourceType, resourceId: envelope.resourceId }
          );
        }
      },
      onError: (err) => {
        log.error({ err, connectionId: connection.id }, 'Exchange stream error');
      },
    });

    active.set(connection.id, handle);
  }

  function stopStreamForConnection(connectionId) {
    const handle = active.get(connectionId);
    if (!handle) return;
    try {
      handle.close?.();
    } catch (err) {
      log.warn({ err, connectionId }, 'Failed to close stream');
    }
    active.delete(connectionId);
    log.debug({ connectionId }, 'Exchange stream stopped');
  }

  return {
    async start() {
      const { rows } = await db.query(
        `SELECT * FROM exchange_connections WHERE status = 'active'`
      );
      for (const connection of rows) {
        try {
          startStreamForConnection(connection);
        } catch (err) {
          log.error({ err, connectionId: connection.id }, 'Failed to start stream');
        }
      }
      log.info({ count: active.size }, 'Exchange streams started');
    },

    startStreamForConnection,
    stopStreamForConnection,

    async shutdown() {
      for (const connectionId of active.keys()) {
        stopStreamForConnection(connectionId);
      }
    },
  };
}

export default createExchangeStreams;