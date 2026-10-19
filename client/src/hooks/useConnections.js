import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { connectionsApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useConnections(params = {}, enabled = true) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.connections.list(params),
    queryFn: () => connectionsApi.list(params),
    enabled,
    staleTime: 30_000,
  });

  const exchangeRegistryQuery = useQuery({
    queryKey: queryKeys.connections.exchangeRegistry,
    queryFn: () => connectionsApi.listExchangeRegistry(),
    staleTime: 5 * 60_000,
  });

  const createConnection = useMutation({
    mutationFn: (payload) => connectionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
    },
  });

  const validateConnection = useMutation({
    mutationFn: (connectionId) => connectionsApi.validate(connectionId),
    onSuccess: (_data, connectionId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connections.detail(connectionId),
      });
    },
  });

  const rotateCredentials = useMutation({
    mutationFn: ({ connectionId, ...payload }) =>
      connectionsApi.rotateCredentials(connectionId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connections.detail(variables.connectionId),
      });
    },
  });

  const suspendConnection = useMutation({
    mutationFn: ({ connectionId, ...payload }) => connectionsApi.suspend(connectionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
    },
  });

  const disconnect = useMutation({
    mutationFn: ({ connectionId, ...payload }) => connectionsApi.disconnect(connectionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
    },
  });

  const removeConnection = useMutation({
    mutationFn: (connectionId) => connectionsApi.remove(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.connections.all });
    },
  });

  return {
    connections: listQuery.data?.items ?? [],
    data: listQuery.data,
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,
    exchangeRegistry: exchangeRegistryQuery.data ?? [],
    exchangeRegistryIsLoading: exchangeRegistryQuery.isLoading,
    exchangeRegistryError: exchangeRegistryQuery.error,
    createConnection: createConnection.mutateAsync,
    validateConnection: validateConnection.mutateAsync,
    rotateCredentials: rotateCredentials.mutateAsync,
    suspendConnection: suspendConnection.mutateAsync,
    disconnect: disconnect.mutateAsync,
    removeConnection: removeConnection.mutateAsync,
    isCreating: createConnection.isPending,
  };
}

export function useExchangeRegistry(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.connections.exchangeRegistry,
    queryFn: () => connectionsApi.listExchangeRegistry(),
    enabled,
    staleTime: 5 * 60_000,
    select: (exchanges) =>
      (Array.isArray(exchanges) ? exchanges : [])
        .filter((exchange) => exchange.status === 'available')
        .map((exchange) => ({
          ...exchange,
          id: exchange.code,
          name: exchange.displayName,
        })),
  });

  return {
    exchanges: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useConnection(connectionId, accountId = null) {
  const detailQuery = useQuery({
    queryKey: queryKeys.connections.detail(connectionId),
    queryFn: () => connectionsApi.getById(connectionId),
    enabled: Boolean(connectionId),
    staleTime: 30_000,
  });

  const accountsQuery = useQuery({
    queryKey: queryKeys.connections.accounts(connectionId),
    queryFn: () => connectionsApi.listAccounts(connectionId),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
  });

  const balancesQuery = useQuery({
    queryKey: queryKeys.connections.balances(accountId ?? `${connectionId}:primary`),
    queryFn: async () => {
      let targetAccountId = accountId;
      if (!targetAccountId) {
        const accounts = await connectionsApi.listAccounts(connectionId);
        targetAccountId = accounts[0]?.id;
      }
      return targetAccountId ? connectionsApi.listBalances(targetAccountId) : { items: [] };
    },
    enabled: Boolean(connectionId),
    staleTime: 30_000,
  });

  const healthQuery = useQuery({
    queryKey: queryKeys.connections.health(connectionId),
    queryFn: () => connectionsApi.getHealth(connectionId),
    enabled: Boolean(connectionId),
    refetchInterval: 30_000,
  });

  const permissionsQuery = useQuery({
    queryKey: queryKeys.connections.permissions(connectionId),
    queryFn: () => connectionsApi.getPermissions(connectionId),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
  });

  return {
    connection: detailQuery.data ?? null,
    accounts: accountsQuery.data ?? [],
    balances: balancesQuery.data?.items ?? [],
    health: healthQuery.data ?? null,
    permissions: permissionsQuery.data ?? null,
    isLoading: detailQuery.isLoading,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
  };
}
