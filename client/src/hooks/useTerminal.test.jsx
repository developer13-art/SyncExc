import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { terminalApi } from '../api/index.js';
import { useTerminalOrders } from './useTerminal.js';

vi.mock('../api/index.js', () => ({
  terminalApi: {
    cancelOrder: vi.fn(),
    listOrders: vi.fn(),
    submitOrder: vi.fn(),
  },
}));

describe('useTerminalOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalApi.listOrders.mockResolvedValue({ items: [], meta: {} });
  });

  test('exposes the list query refetch function', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useTerminalOrders('workspace-id', { accountId: 'account-id', status: 'open' }),
      { wrapper },
    );
    await waitFor(() => {
      expect(terminalApi.listOrders).toHaveBeenCalledOnce();
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ items: [], meta: {} });
    expect(typeof result.current.refetch).toBe('function');

    await act(async () => {
      await result.current.refetch();
    });

    expect(terminalApi.listOrders).toHaveBeenCalledTimes(2);
  });
});
