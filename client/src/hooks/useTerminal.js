import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { terminalApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useTerminalOverview(workspaceId) {
  return useQuery({
    queryKey: queryKeys.terminal.overview(workspaceId),
    queryFn: () => terminalApi.getOverview(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useTerminalOrders(workspaceId, params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.terminal.orders(workspaceId, params),
    queryFn: () => terminalApi.listOrders(workspaceId, params),
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const submitOrder = useMutation({
    mutationFn: (payload) => terminalApi.submitOrder(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.orders(workspaceId, {}),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.positions(workspaceId, {}),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.balances(workspaceId, {}),
      });
    },
  });

  const cancelOrder = useMutation({
    mutationFn: ({ orderId, ...payload }) =>
      terminalApi.cancelOrder(workspaceId, orderId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.orders(workspaceId, {}),
      });
    },
  });

  return {
    orders: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    submitOrder: submitOrder.mutateAsync,
    cancelOrder: cancelOrder.mutateAsync,
    isSubmitting: submitOrder.isPending,
  };
}

export function useTerminalPositions(workspaceId, params = {}) {
  return useQuery({
    queryKey: queryKeys.terminal.positions(workspaceId, params),
    queryFn: () => terminalApi.listPositions(workspaceId, params),
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useTerminalBalances(workspaceId, params = {}) {
  return useQuery({
    queryKey: queryKeys.terminal.balances(workspaceId, params),
    queryFn: () => terminalApi.listBalances(workspaceId, params),
    enabled: Boolean(workspaceId),
    staleTime: 20_000,
  });
}

export function useTerminalTrades(workspaceId, params = {}) {
  return useQuery({
    queryKey: queryKeys.terminal.trades(workspaceId, params),
    queryFn: () => terminalApi.listTrades(workspaceId, params),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

export function useTerminalExecutions(workspaceId, params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.terminal.executions(workspaceId, params),
    queryFn: () => terminalApi.listExecutions(workspaceId, params),
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const requestReconciliation = useMutation({
    mutationFn: (recordId) => terminalApi.requestReconciliation(workspaceId, recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.executions(workspaceId, {}),
      });
    },
  });

  return {
    executions: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    requestReconciliation: requestReconciliation.mutateAsync,
  };
}

export function useTerminalMarkets(workspaceId, params = {}) {
  return useQuery({
    queryKey: queryKeys.terminal.markets(workspaceId, params),
    queryFn: () => terminalApi.listMarkets(workspaceId, params),
    enabled: Boolean(workspaceId && params.exchangeCode),
    staleTime: 10_000,
  });
}