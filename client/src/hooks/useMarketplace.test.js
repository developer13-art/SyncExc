import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/errors.js';
import { marketplaceApi } from '../api/index.js';
import { useMarketplaceProvider } from './useMarketplace.js';

vi.mock('../api/index.js', () => ({
  marketplaceApi: {
    getProvider: vi.fn(),
    listProviderPlans: vi.fn(),
    getProviderPerformance: vi.fn(),
    getProviderDisclosures: vi.fn(),
    createSubscription: vi.fn(),
  },
}));

describe('useMarketplaceProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not request provider details after the profile lookup returns 404', async () => {
    marketplaceApi.getProvider.mockRejectedValue(
      new ApiError({ message: 'Provider not found', status: 404 }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useMarketplaceProvider('missing-provider'), { wrapper });

    await waitFor(() => expect(result.current.error).toMatchObject({ status: 404 }));
    expect(marketplaceApi.listProviderPlans).not.toHaveBeenCalled();
    expect(marketplaceApi.getProviderPerformance).not.toHaveBeenCalled();
    expect(marketplaceApi.getProviderDisclosures).not.toHaveBeenCalled();
  });

  it('loads dependent provider data after the profile is found', async () => {
    marketplaceApi.getProvider.mockResolvedValue({ id: 'provider-1' });
    marketplaceApi.listProviderPlans.mockResolvedValue([]);
    marketplaceApi.getProviderPerformance.mockResolvedValue({});
    marketplaceApi.getProviderDisclosures.mockResolvedValue([]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    renderHook(() => useMarketplaceProvider('provider-1'), { wrapper });

    await waitFor(() => {
      expect(marketplaceApi.listProviderPlans).toHaveBeenCalledWith('provider-1');
      expect(marketplaceApi.getProviderPerformance).toHaveBeenCalledWith('provider-1');
      expect(marketplaceApi.getProviderDisclosures).toHaveBeenCalledWith('provider-1');
    });
  });
});
