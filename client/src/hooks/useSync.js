import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { synchronizationApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useSyncGroups(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.sync.groups(params),
    queryFn: () => synchronizationApi.listGroups(params),
    staleTime: 20_000,
  });

  const createGroup = useMutation({
    mutationFn: (payload) => synchronizationApi.createGroup(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync'] }),
  });

  const pauseGroup = useMutation({
    mutationFn: ({ groupId, ...payload }) => synchronizationApi.pauseGroup(groupId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync'] }),
  });

  const resumeGroup = useMutation({
    mutationFn: (groupId) => synchronizationApi.resumeGroup(groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync'] }),
  });

  const activateGroup = useMutation({
    mutationFn: (groupId) => synchronizationApi.activateGroup(groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync'] }),
  });

  return {
    groups: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    createGroup: createGroup.mutateAsync,
    pauseGroup: pauseGroup.mutateAsync,
    resumeGroup: resumeGroup.mutateAsync,
    activateGroup: activateGroup.mutateAsync,
  };
}

export function useSyncGroup(groupId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.sync.group(groupId),
    queryFn: () => synchronizationApi.getGroup(groupId),
    enabled: Boolean(groupId),
    staleTime: 20_000,
  });

  const healthQuery = useQuery({
    queryKey: queryKeys.sync.health(groupId),
    queryFn: () => synchronizationApi.getHealth(groupId),
    enabled: Boolean(groupId),
    refetchInterval: 30_000,
  });

  const destinationsQuery = useQuery({
    queryKey: queryKeys.sync.destinations(groupId),
    queryFn: () => synchronizationApi.listDestinations(groupId),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  });

  const addDestination = useMutation({
    mutationFn: (payload) => synchronizationApi.addDestination(groupId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.destinations(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.group(groupId) });
    },
  });

  const removeDestination = useMutation({
    mutationFn: (destinationId) =>
      synchronizationApi.removeDestination(groupId, destinationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sync.destinations(groupId) });
    },
  });

  return {
    group: detailQuery.data ?? null,
    health: healthQuery.data ?? null,
    destinations: destinationsQuery.data ?? [],
    isLoading: detailQuery.isLoading,
    addDestination: addDestination.mutateAsync,
    removeDestination: removeDestination.mutateAsync,
  };
}

export function useSyncOperations(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.sync.operations(params),
    queryFn: () => synchronizationApi.listOperations(params),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const reconcile = useMutation({
    mutationFn: ({ operationId, ...payload }) =>
      synchronizationApi.reconcileOperation(operationId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync', 'operations'] }),
  });

  const retry = useMutation({
    mutationFn: ({ operationId, ...payload }) =>
      synchronizationApi.retryOperation(operationId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync', 'operations'] }),
  });

  const resolve = useMutation({
    mutationFn: ({ operationId, ...payload }) =>
      synchronizationApi.manualResolve(operationId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync', 'operations'] }),
  });

  return {
    operations: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    reconcile: reconcile.mutateAsync,
    retry: retry.mutateAsync,
    resolve: resolve.mutateAsync,
  };
}