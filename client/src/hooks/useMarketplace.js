import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { marketplaceApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useMarketplaceProviders(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.marketplace.providers(params),
    queryFn: () => marketplaceApi.listProviders(params),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const follow = useMutation({
    mutationFn: ({ providerId, ...payload }) =>
      marketplaceApi.followProvider(providerId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
  });

  const unfollow = useMutation({
    mutationFn: (providerId) => marketplaceApi.unfollowProvider(providerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
  });

  return {
    providers: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    follow: follow.mutateAsync,
    unfollow: unfollow.mutateAsync,
  };
}

export function useMarketplaceProvider(providerId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.marketplace.provider(providerId),
    queryFn: () => marketplaceApi.getProvider(providerId),
    enabled: Boolean(providerId),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const plansQuery = useQuery({
    queryKey: queryKeys.marketplace.providerPlans(providerId),
    queryFn: () => marketplaceApi.listProviderPlans(providerId),
    enabled: Boolean(providerId),
    staleTime: 60_000,
  });

  const performanceQuery = useQuery({
    queryKey: queryKeys.marketplace.providerPerformance(providerId, {}),
    queryFn: () => marketplaceApi.getProviderPerformance(providerId),
    enabled: Boolean(providerId),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const disclosuresQuery = useQuery({
    queryKey: queryKeys.marketplace.providerDisclosures(providerId),
    queryFn: () => marketplaceApi.getProviderDisclosures(providerId),
    enabled: Boolean(providerId),
    staleTime: 5 * 60_000,
  });

  const subscribe = useMutation({
    mutationFn: (payload) => marketplaceApi.createSubscription({ providerId, ...payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
  });

  return {
    provider: detailQuery.data ?? null,
    plans: plansQuery.data ?? [],
    performance: performanceQuery.data ?? null,
    disclosures: disclosuresQuery.data ?? [],
    isLoading: detailQuery.isLoading,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
    performanceIsLoading: performanceQuery.isLoading,
    performanceError: performanceQuery.error,
    refetchPerformance: performanceQuery.refetch,
    subscribe: subscribe.mutateAsync,
  };
}

export function useCopyConfigurations(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.marketplace.copyConfigurations(params),
    queryFn: () => marketplaceApi.listCopyConfigurations(params),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (payload) => marketplaceApi.createCopyConfiguration(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'copy-configs'] }),
  });

  const activate = useMutation({
    mutationFn: ({ configId, ...payload }) =>
      marketplaceApi.activateCopyConfiguration(configId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'copy-configs'] }),
  });

  const pause = useMutation({
    mutationFn: ({ configId, ...payload }) =>
      marketplaceApi.pauseCopyConfiguration(configId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'copy-configs'] }),
  });

  const revoke = useMutation({
    mutationFn: ({ configId, ...payload }) =>
      marketplaceApi.revokeCopyConfiguration(configId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'copy-configs'] }),
  });

  return {
    configurations: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    createConfiguration: create.mutateAsync,
    activateConfiguration: activate.mutateAsync,
    pauseConfiguration: pause.mutateAsync,
    revokeConfiguration: revoke.mutateAsync,
  };
}

export function useCopyConfiguration(configId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.marketplace.copyConfiguration(configId),
    queryFn: () => marketplaceApi.getCopyConfiguration(configId),
    enabled: Boolean(configId),
    staleTime: 30_000,
  });

  const update = useMutation({
    mutationFn: (payload) => marketplaceApi.updateCopyConfiguration(configId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplace.copyConfiguration(configId),
      }),
  });

  const validate = useMutation({
    mutationFn: () => marketplaceApi.validateCopyConfiguration(configId),
  });

  const activate = useMutation({
    mutationFn: () => marketplaceApi.activateCopyConfiguration(configId),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'copy-configs'] }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplace.copyConfiguration(configId),
      }),
    ]),
  });

  const pause = useMutation({
    mutationFn: () => marketplaceApi.pauseCopyConfiguration(configId),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'copy-configs'] }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplace.copyConfiguration(configId),
      }),
    ]),
  });

  const revoke = useMutation({
    mutationFn: () => marketplaceApi.revokeCopyConfiguration(configId),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'copy-configs'] }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.marketplace.copyConfiguration(configId),
      }),
    ]),
  });

  return {
    configuration: detailQuery.data?.config ?? null,
    destinations: detailQuery.data?.destinations ?? [],
    isLoading: detailQuery.isLoading,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
    updateConfiguration: update.mutateAsync,
    validateConfiguration: validate.mutateAsync,
    activateConfiguration: activate.mutateAsync,
    pauseConfiguration: pause.mutateAsync,
    revokeConfiguration: revoke.mutateAsync,
  };
}