/**
 * SyncExc Server — Realtime subsystem
 *
 * Attaches a WebSocket server to the same HTTP server as the API. Handles:
 *   - session authentication on connect
 *   - subscription to user-scoped and workspace-scoped channels
 *   - server-side authorization of every channel
 *   - broadcasting events from the event bus to subscribed clients
 *
 * Public surface:
 *   realtime.attach(httpServer)          — bind the WS server to an HTTP server
 *   realtime.broadcast(channel, type, payload) — send to all connections on a channel
 *   realtime.broadcastToUser(userId, ...)      — send to all connections of a user
 *   realtime.broadcastToWorkspace(wsId, ...)   — send to all connections in a workspace
 *   realtime.shutdown()                        — close all connections and the server
 */

import { createLogger } from '../lib/logger.js';
import { createWebSocketServer } from './server.js';
import { createRoomManager } from './rooms.js';
import { createBroadcaster } from './broadcaster.js';

export function initRealtime({ redis, logger: injectedLogger, events }) {
  const logger = injectedLogger || createLogger({ component: 'realtime' });

  const rooms = createRoomManager({ logger });
  const broadcaster = createBroadcaster({ rooms, logger, events });

  const server = createWebSocketServer({
    rooms,
    broadcaster,
    redis,
    logger,
  });

  // Wire the event bus to the broadcaster so events get fanned out live.
  if (events && events.bus) {
    events.bus.on('*', (envelope) => broadcaster.handleEvent(envelope));
  }

  return {
    attach(httpServer) {
      server.attach(httpServer);
      logger.info('Realtime attached to HTTP server');
    },

    broadcast(channel, type, payload) {
      broadcaster.broadcast(channel, type, payload);
    },

    broadcastToUser(userId, type, payload) {
      broadcaster.broadcastToUser(userId, type, payload);
    },

    broadcastToWorkspace(workspaceId, type, payload) {
      broadcaster.broadcastToWorkspace(workspaceId, type, payload);
    },

    stats() {
      return {
        connections: server.connectionCount(),
        rooms: rooms.stats(),
      };
    },

    async shutdown() {
      logger.info('Shutting down realtime subsystem');
      await server.shutdown();
    },
  };
}

export default initRealtime;