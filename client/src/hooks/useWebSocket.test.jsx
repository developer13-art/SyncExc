import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { store } from '../app/store.js';
import { authActions } from '../features/auth/authSlice.js';
import { useWebSocket } from './useWebSocket.js';

const sockets = [];

class MockWebSocket {
  static OPEN = 1;

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    sockets.push(this);
  }

  send(message) {
    this.sent.push(JSON.parse(message));
  }

  close(code = 1000, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

describe('useWebSocket', () => {
  afterEach(() => {
    store.dispatch(authActions.logoutFulfilled());
    sockets.length = 0;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('authenticates after opening without putting the session token in the URL', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket);
    store.dispatch(authActions.loginSucceeded({
      user: { id: 'user-1' },
      accessToken: 'test-access-token',
    }));

    const { result, unmount } = renderHook(
      () => useWebSocket({ channels: ['notifications'] }),
      { reactStrictMode: true },
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(sockets).toHaveLength(1);
    const socket = sockets[0];
    expect(socket.url).not.toContain('test-access-token');

    act(() => {
      socket.readyState = MockWebSocket.OPEN;
      socket.onopen();
    });
    expect(socket.sent).toEqual([{ type: 'auth', token: 'test-access-token' }]);

    act(() => {
      socket.onmessage({ data: JSON.stringify({ type: 'auth_ack' }) });
    });

    expect(result.current.isConnected).toBe(true);
    expect(socket.sent).toEqual([
      { type: 'auth', token: 'test-access-token' },
      { type: 'subscribe', channel: 'notifications' },
    ]);

    unmount();
  });
});
