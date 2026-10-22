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

  const syncAccountState = useMutation({
    mutationFn: (accountId) => terminalApi.syncAccountState(workspaceId, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.orders(workspaceId, {}),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.positions(workspaceId, {}),
      });
    },
  });

  return {
    ...listQuery,
    orders: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    submitOrder: submitOrder.mutateAsync,
    cancelOrder: cancelOrder.mutateAsync,
    syncAccountState: syncAccountState.mutateAsync,
    isSubmitting: submitOrder.isPending,
    isSyncingAccountState: syncAccountState.isPending,
  };
}

export function useTerminalPositions(workspaceId, params = {}) {
  const queryClient = useQueryClient();
  const positionsQuery = useQuery({
    queryKey: queryKeys.terminal.positions(workspaceId, params),
    queryFn: () => terminalApi.listPositions(workspaceId, params),
    enabled: Boolean(workspaceId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const syncAccountState = useMutation({
    mutationFn: (accountId) => terminalApi.syncAccountState(workspaceId, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.positions(workspaceId, {}),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.orders(workspaceId, {}),
      });
    },
  });

  return {
    ...positionsQuery,
    syncAccountState: syncAccountState.mutateAsync,
    isSyncingAccountState: syncAccountState.isPending,
  };
}

export function useTerminalAccountSync(workspaceId, accountId) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['terminal', 'exchange-sync', workspaceId, accountId],
    queryFn: async () => {
      const result = await terminalApi.syncAccountState(workspaceId, accountId);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.terminal.positions(workspaceId, {}),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.terminal.orders(workspaceId, {}),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.terminal.trades(workspaceId, {}),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.terminal.overview(workspaceId),
        }),
      ]);
      return result;
    },
    enabled: Boolean(workspaceId && accountId),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}

export function useTerminalAccountsSync(workspaceId, accounts = []) {
  const queryClient = useQueryClient();
  const accountIds = [...new Set(accounts.map((account) => account.id).filter(Boolean))].sort();
  return useQuery({
    queryKey: ['terminal', 'exchange-sync-workspace', workspaceId, accountIds],
    queryFn: async () => {
      const results = await Promise.all(
        accountIds.map((accountId) => terminalApi.syncAccountState(workspaceId, accountId))
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.terminal.positions(workspaceId, {}),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.terminal.orders(workspaceId, {}),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.terminal.trades(workspaceId, {}),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.terminal.overview(workspaceId),
        }),
      ]);
      return results;
    },
    enabled: Boolean(workspaceId && accountIds.length),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
    refetchOnWindowFocus: true,
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
    staleTime: 5_000,
    refetchInterval: 15_000,
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

export function useTerminalMarketData(workspaceId, params = {}) {
  const enabled = Boolean(workspaceId && params.exchangeCode && params.symbol);
  return useQuery({
    queryKey: queryKeys.terminal.marketData(workspaceId, params),
    queryFn: () => terminalApi.getMarketData(workspaceId, params),
    enabled,
    staleTime: 2_000,
    refetchInterval: 5_000,
    retry: 1,
  });
}