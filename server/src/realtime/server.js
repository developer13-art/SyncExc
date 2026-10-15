/**
 * SyncExc Server — WebSocket server
 *
 * Binds to the HTTP server (same port). On connect, the client must send
 * an `auth` message with a session token within 5 seconds or the connection
 * is closed.
 *
 * Client → Server messages:
 *   { type: 'auth', token }
 *   { type: 'subscribe', channels: ['user:<id>', 'workspace:<id>'] }
 *   { type: 'unsubscribe', channels: [...] }
 *   { type: 'ping' }
 *
 * Server → Client messages:
 *   { type: 'auth_ack', userId, workspaceIds }
 *   { type: 'auth_error', code }
 *   { type: 'subscribed', channels }
 *   { type: 'unsubscribed', channels }
 *   { type: 'event', channel, eventType, payload, occurredAt }
 *   { type: 'pong' }
 *   { type: 'error', code, message }
 */

import { WebSocketServer } from 'ws';
import { URL } from 'node:url';
import config from '../config.js';
import { createLogger } from '../lib/logger.js';
import { resolveSessionFromToken } from './auth.js';

const AUTH_TIMEOUT_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 25000;
const MAX_MESSAGE_BYTES = 64 * 1024;
const MAX_CONNECTIONS_PER_USER = 10;

export function createWebSocketServer({ rooms, broadcaster, db, logger: injectedLogger }) {
  const logger = injectedLogger || createLogger({ component: 'realtime:server' });

  let wss;
  let heartbeatTimer;

  function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
      if (!wss) return;
      for (const ws of wss.clients) {
        if (ws._alive === false) {
          logger.debug({ userId: ws._userId }, 'Terminating unresponsive WebSocket');
          ws.terminate();
          continue;
        }
        ws._alive = false;
        try {
          ws.ping();
        } catch {
          // ignore
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
    heartbeatTimer.unref?.();
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function send(ws, msg) {
    if (ws.readyState !== ws.OPEN) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch (err) {
      logger.warn({ err }, 'Failed to send WebSocket message');
    }
  }

  function sendError(ws, code, message) {
    send(ws, { type: 'error', code, message });
  }

  async function handleAuth(ws, message) {
    const { token } = message;
    if (!token || typeof token !== 'string') {
      send(ws, { type: 'auth_error', code: 'INVALID_TOKEN' });
      ws.close(4401, 'Invalid token');
      return;
    }

    const session = await resolveSessionFromToken(token, { db, logger });
    if (!session) {
      send(ws, { type: 'auth_error', code: 'INVALID_TOKEN' });
      ws.close(4401, 'Authentication failed');
      return;
    }

    ws._authenticated = true;
    ws._userId = session.userId;
    ws._sessionId = session.sessionId;
    ws._workspaceIds = new Set(session.workspaceIds || []);

    // Enforce per-user connection limit
    const userConns = rooms.connectionsForUser(session.userId);
    if (userConns.length >= MAX_CONNECTIONS_PER_USER) {
      const oldest = userConns
        .slice()
        .sort((a, b) => a._connectedAt - b._connectedAt)[0];
      if (oldest) {
        logger.debug(
          { userId: session.userId, closedOldest: true },
          'Closing oldest connection for user'
        );
        try {
          oldest.close(4409, 'Too many connections');
        } catch {
          // ignore
        }
      }
    }

    rooms.registerConnection(ws);

    send(ws, {
      type: 'auth_ack',
      userId: session.userId,
      workspaceIds: Array.from(ws._workspaceIds),
    });

    logger.debug(
      { userId: session.userId, connectionId: ws._connectionId },
      'WebSocket authenticated'
    );
  }

  async function handleSubscribe(ws, message) {
    if (!ws._authenticated) {
      sendError(ws, 'NOT_AUTHENTICATED', 'Authenticate before subscribing');
      return;
    }

    const channels = Array.isArray(message.channels) ? message.channels : [];
    if (channels.length === 0) {
      sendError(ws, 'NO_CHANNELS', 'No channels specified');
      return;
    }

    const subscribed = [];
    for (const channel of channels) {
      if (!rooms.authorizeChannel(ws, channel)) {
        logger.debug(
          { userId: ws._userId, channel },
          'WebSocket channel subscription denied'
        );
        continue;
      }
      rooms.join(ws, channel);
      subscribed.push(channel);
    }

    send(ws, { type: 'subscribed', channels: subscribed });
  }

  function handleUnsubscribe(ws, message) {
    if (!ws._authenticated) return;
    const channels = Array.isArray(message.channels) ? message.channels : [];
    for (const channel of channels) {
      rooms.leave(ws, channel);
    }
    send(ws, { type: 'unsubscribed', channels });
  }

  function handleMessage(ws, raw) {
    if (raw.length > MAX_MESSAGE_BYTES) {
      sendError(ws, 'MESSAGE_TOO_LARGE', 'Message exceeds size limit');
      return;
    }

    let message;
    try {
      message = JSON.parse(raw.toString('utf8'));
    } catch {
      sendError(ws, 'INVALID_JSON', 'Message is not valid JSON');
      return;
    }

    if (!message || typeof message.type !== 'string') {
      sendError(ws, 'INVALID_MESSAGE', 'Message must have a "type" field');
      return;
    }

    switch (message.type) {
      case 'auth':
        handleAuth(ws, message).catch((err) => {
          logger.error({ err }, 'Auth handler failed');
          sendError(ws, 'AUTH_FAILED', 'Authentication failed');
          ws.close(4401, 'Auth failed');
        });
        return;

      case 'subscribe':
        handleSubscribe(ws, message).catch((err) => {
          logger.error({ err }, 'Subscribe handler failed');
          sendError(ws, 'SUBSCRIBE_FAILED', 'Subscription failed');
        });
        return;

      case 'unsubscribe':
        handleUnsubscribe(ws, message);
        return;

      case 'ping':
        send(ws, { type: 'pong', at: new Date().toISOString() });
        return;

      default:
        sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${message.type}`);
    }
  }

  function handleConnection(ws, req) {
    ws._connectionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    ws._connectedAt = Date.now();
    ws._authenticated = false;
    ws._alive = true;

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    ws._ip = clientIp;

    logger.trace({ connectionId: ws._connectionId, ip: clientIp }, 'WebSocket connected');

    // Force auth within AUTH_TIMEOUT_MS
    const authTimer = setTimeout(() => {
      if (!ws._authenticated) {
        logger.debug({ connectionId: ws._connectionId }, 'Auth timeout');
        try {
          send(ws, { type: 'auth_error', code: 'AUTH_TIMEOUT' });
          ws.close(4401, 'Auth timeout');
        } catch {
          // ignore
        }
      }
    }, AUTH_TIMEOUT_MS);
    authTimer.unref?.();

    ws.on('pong', () => {
      ws._alive = true;
    });

    ws.on('message', (raw) => handleMessage(ws, raw));

    ws.on('close', (code, reason) => {
      clearTimeout(authTimer);
      rooms.unregisterConnection(ws);
      logger.trace(
        { connectionId: ws._connectionId, code, reason: reason?.toString() },
        'WebSocket closed'
      );
    });

    ws.on('error', (err) => {
      logger.warn({ err, connectionId: ws._connectionId }, 'WebSocket error');
    });

    // Send a hello with server time so clients can compute clock drift
    send(ws, { type: 'hello', serverTime: new Date().toISOString() });
  }

  return {
    attach(httpServer) {
      wss = new WebSocketServer({
        server: httpServer,
        path: config.websocket.path,
        maxPayload: MAX_MESSAGE_BYTES,
      });

      wss.on('connection', handleConnection);
      wss.on('error', (err) => logger.error({ err }, 'WebSocket server error'));

      startHeartbeat();
      logger.info({ path: config.websocket.path }, 'WebSocket server attached');
    },

    connectionCount() {
      return wss ? wss.clients.size : 0;
    },

    async shutdown() {
      stopHeartbeat();
      if (!wss) return;

      // Notify clients and close gracefully
      const clients = Array.from(wss.clients);
      for (const ws of clients) {
        try {
          send(ws, { type: 'shutdown', reason: 'server_restart' });
          ws.close(1001, 'Server shutdown');
        } catch {
          // ignore
        }
      }

      await new Promise((resolve) => {
        wss.close(() => resolve());
        // Force termination after 3s
        setTimeout(() => {
          for (const ws of wss.clients) ws.terminate();
          resolve();
        }, 3000).unref?.();
      });

      wss = null;
      logger.info('WebSocket server stopped');
    },

    sendToConnection(ws, msg) {
      send(ws, msg);
    },
  };
}

export default createWebSocketServer;