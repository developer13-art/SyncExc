import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStore, mockAxiosInstance } = vi.hoisted(() => ({
  mockStore: {
    dispatch: vi.fn(),
    getState: vi.fn(() => ({ auth: { accessToken: 'expired-token' }, workspace: {} })),
  },
  mockAxiosInstance: {
    post: vi.fn(),
    request: vi.fn(),
  },
}));

vi.mock('../app/store.js', () => ({ store: mockStore }));
vi.mock('./client.js', () => ({ default: mockAxiosInstance }));

import { handleResponseError } from './interceptors.js';

describe('authentication response recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renews the access token using the session cookie and retries the failed request', async () => {
    mockAxiosInstance.post.mockResolvedValue({
      data: { data: { accessToken: 'renewed-token' } },
    });
    mockAxiosInstance.request.mockResolvedValue({ data: 'ok' });
    const request = {
      config: {
        url: '/terminal/orders',
        headers: {},
      },
      response: { status: 401, data: {} },
    };

    await expect(handleResponseError(request)).resolves.toEqual({ data: 'ok' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/auth/refresh',
      {},
      { skipAuthRefresh: true, _retryAttempted: true },
    );
    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        _retryAttempted: true,
        headers: expect.objectContaining({ Authorization: 'Bearer renewed-token' }),
      }),
    );
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth/tokenRefreshed' }),
    );
  });

  it('expires the local session when the session cookie cannot renew a 401', async () => {
    mockAxiosInstance.post.mockRejectedValue({
      config: { url: '/auth/refresh' },
      response: { status: 401, data: {} },
    });

    await expect(
      handleResponseError({
        config: { url: '/terminal/orders', headers: {} },
        response: { status: 401, data: {} },
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth/sessionExpired' }),
    );
  });
});
