import { useEffect, useRef, useCallback, useState } from 'react';

import { apiConfig } from '../config/api.config.js';
import { selectAccessToken } from '../features/auth/authSlice.js';
import { store } from '../app/store.js';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

export function useWebSocket({ channels = [], autoConnect = true } = {}) {
  const wsRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const connectionStartTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const listenersRef = useRef(new Map());
  const subscribedChannelsRef = useRef(new Set(channels));

  const [status, setStatus] = useState('disconnected');

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const subscribe = useCallback(
    (channel) => {
      subscribedChannelsRef.current.add(channel);
      if (status === 'connected') {
        send({ type: 'subscribe', channel });
      }
    },
    [send, status],
  );

  const unsubscribe = useCallback(
    (channel) => {
      subscribedChannelsRef.current.delete(channel);
      if (status === 'connected') {
        send({ type: 'unsubscribe', channel });
      }
    },
    [send, status],
  );

  const on = useCallback((event, handler) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event).add(handler);
    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const emit = useCallback((event, payload) => {
    const handlers = listenersRef.current.get(event);
    if (!handlers) {
      return;
    }
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch {
        // Do not allow a listener to break the socket loop.
      }
    });
  }, []);

  const scheduleReconnect = useCallback(() => {
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
    const jitter = Math.random() * 500;
    reconnectAttemptRef.current = attempt + 1;

    reconnectTimerRef.current = setTimeout(() => {
      connectRef.current?.();
    }, delay + jitter);
  }, []);

  const connect = useCallback(() => {
    const token = selectAccessToken(store.getState());
    if (!token) {
      setStatus('unauthenticated');
      return;
    }

    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');

    const ws = new WebSocket(apiConfig.wsURL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'auth_ack') {
        reconnectAttemptRef.current = 0;
        setStatus('connected');
        emit('connected', null);
        subscribedChannelsRef.current.forEach((channel) => {
          ws.send(JSON.stringify({ type: 'subscribe', channel }));
        });
        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL_MS);
      } else if (message.type === 'auth_error') {
        setStatus('unauthenticated');
      }
      if (message.type === 'pong') {
        return;
      }
      emit(message.type, message.payload ?? message);
      emit('*', message);
    };

    ws.onerror = () => {
      emit('error', null);
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      clearTimers();
      setStatus('disconnected');
      emit('disconnected', { code: event.code, reason: event.reason });

      if (event.code === 1000) {
        return;
      }
      if ([4001, 4003, 4401, 4403].includes(event.code)) {
        setStatus('unauthenticated');
        return;
      }
      scheduleReconnect();
    };
  }, [clearTimers, emit, scheduleReconnect, send]);

  const disconnect = useCallback(() => {
    clearTimers();
    if (connectionStartTimerRef.current) {
      clearTimeout(connectionStartTimerRef.current);
      connectionStartTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'client_disconnect');
      } catch {
        // Ignore close errors.
      }
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [clearTimers]);

  const connectRef = useRef(connect);
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!autoConnect) {
      return undefined;
    }
    connectionStartTimerRef.current = setTimeout(() => {
      connectionStartTimerRef.current = null;
      connectRef.current?.();
    }, 0);
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]);

  useEffect(() => {
    const interval = setInterval(() => {
      const token = selectAccessToken(store.getState());
      if (!token && wsRef.current) {
        disconnect();
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [disconnect]);

  return {
    status,
    isConnected: status === 'connected',
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    on,
  };
}