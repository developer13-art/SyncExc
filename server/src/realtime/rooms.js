/**
 * SyncExc Server — Room manager
 *
 * A "room" is a named channel (e.g. `user:<uuid>`, `workspace:<uuid>`).
 * Multiple WebSocket connections can be in the same room.
 *
 * Authorization rules:
 *   user:<userId>            → connection's userId must equal <userId>
 *   workspace:<workspaceId>  → connection must be a member of the workspace
 *   session:<sessionId>      → connection's sessionId must equal <sessionId>
 *
 * Any channel not matching these patterns is refused.
 */

import { createLogger } from '../lib/logger.js';

export function createRoomManager({ logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'realtime:rooms' });

  // channel -> Set<ws>
  const channels = new Map();
  // userId -> Set<ws>
  const userConnections = new Map();
  // ws -> Set<channel>
  const connectionChannels = new Map();

  function authorizeChannel(ws, channel) {
    if (typeof channel !== 'string') return false;

    const colonIdx = channel.indexOf(':');
    if (colonIdx === -1) return false;

    const scope = channel.slice(0, colonIdx);
    const id = channel.slice(colonIdx + 1);

    if (!id) return false;

    switch (scope) {
      case 'user':
        return ws._userId === id;
      case 'session':
        return ws._sessionId === id;
      case 'workspace':
        return ws._workspaceIds && ws._workspaceIds.has(id);
      default:
        return false;
    }
  }

  return {
    registerConnection(ws) {
      const userId = ws._userId;
      if (!userId) return;

      if (!userConnections.has(userId)) userConnections.set(userId, new Set());
      userConnections.get(userId).add(ws);

      connectionChannels.set(ws, new Set());

      // Auto-join the user's own channel and session channel
      this.join(ws, `user:${userId}`);
      if (ws._sessionId) this.join(ws, `session:${ws._sessionId}`);
    },

    unregisterConnection(ws) {
      const userId = ws._userId;
      if (userId && userConnections.has(userId)) {
        userConnections.get(userId).delete(ws);
        if (userConnections.get(userId).size === 0) userConnections.delete(userId);
      }

      const joined = connectionChannels.get(ws);
      if (joined) {
        for (const channel of joined) {
          const set = channels.get(channel);
          if (set) {
            set.delete(ws);
            if (set.size === 0) channels.delete(channel);
          }
        }
      }

      connectionChannels.delete(ws);
    },

    join(ws, channel) {
      if (!channels.has(channel)) channels.set(channel, new Set());
      channels.get(channel).add(ws);

      if (!connectionChannels.has(ws)) connectionChannels.set(ws, new Set());
      connectionChannels.get(ws).add(channel);
    },

    leave(ws, channel) {
      const set = channels.get(channel);
      if (set) {
        set.delete(ws);
        if (set.size === 0) channels.delete(channel);
      }
      const joined = connectionChannels.get(ws);
      if (joined) joined.delete(channel);
    },

    connectionsForChannel(channel) {
      return channels.has(channel) ? Array.from(channels.get(channel)) : [];
    },

    connectionsForUser(userId) {
      return userConnections.has(userId) ? Array.from(userConnections.get(userId)) : [];
    },

    channelsForConnection(ws) {
      return connectionChannels.has(ws) ? Array.from(connectionChannels.get(ws)) : [];
    },

    authorizeChannel,

    stats() {
      return {
        channels: channels.size,
        connections: userConnections.size,
      };
    },

    /**
     * Broadcast a message to all connections in a channel.
     * The message is sent as-is; callers must provide the full payload.
     */
    sendToChannel(channel, message, { skipConnectionId } = {}) {
      const conns = this.connectionsForChannel(channel);
      let delivered = 0;

      for (const ws of conns) {
        if (skipConnectionId && ws._connectionId === skipConnectionId) continue;
        if (ws.readyState !== ws.OPEN) continue;
        try {
          ws.send(JSON.stringify(message));
          delivered += 1;
        } catch (err) {
          logger.warn({ err, channel }, 'Failed to send to WebSocket');
        }
      }

      return delivered;
    },
  };
}

export default createRoomManager;