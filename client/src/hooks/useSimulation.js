import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { simulationApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useSimulationEnvironments(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.simulation.environments(params),
    queryFn: () => simulationApi.listEnvironments(params),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (payload) => simulationApi.createEnvironment(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulation'] }),
  });

  const archive = useMutation({
    mutationFn: (environmentId) => simulationApi.archiveEnvironment(environmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulation'] }),
  });

  return {
    environments: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    createEnvironment: create.mutateAsync,
    archiveEnvironment: archive.mutateAsync,
  };
}

export function useSimulationEnvironment(environmentId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.simulation.environment(environmentId),
    queryFn: () => simulationApi.getEnvironment(environmentId),
    enabled: Boolean(environmentId),
    staleTime: 30_000,
  });

  const versionsQuery = useQuery({
    queryKey: queryKeys.simulation.environmentVersions(environmentId),
    queryFn: () => simulationApi.listEnvironmentVersions(environmentId),
    enabled: Boolean(environmentId),
    staleTime: 60_000,
  });

  const update = useMutation({
    mutationFn: (payload) => simulationApi.updateEnvironment(environmentId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.simulation.environment(environmentId),
      }),
  });

  return {
    environment: detailQuery.data ?? null,
    versions: versionsQuery.data ?? [],
    isLoading: detailQuery.isLoading,
    updateEnvironment: update.mutateAsync,
  };
}

export function useSimulationRuns(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.simulation.runs(params),
    queryFn: () => simulationApi.listRuns(params),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const start = useMutation({
    mutationFn: (payload) => simulationApi.startRun(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulation', 'runs'] }),
  });

  const cancel = useMutation({
    mutationFn: (runId) => simulationApi.cancelRun(runId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulation', 'runs'] }),
  });

  return {
    runs: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    startRun: start.mutateAsync,
    cancelRun: cancel.mutateAsync,
  };
}

export function useSimulationRun(runId) {
  const detailQuery = useQuery({
    queryKey: queryKeys.simulation.run(runId),
    queryFn: () => simulationApi.getRun(runId),
    enabled: Boolean(runId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const metricsQuery = useQuery({
    queryKey: queryKeys.simulation.runMetrics(runId),
    queryFn: () => simulationApi.getRunMetrics(runId),
    enabled: Boolean(runId),
    staleTime: 60_000,
  });

  const reportQuery = useQuery({
    queryKey: queryKeys.simulation.runReport(runId),
    queryFn: () => simulationApi.getRunReport(runId),
    enabled: Boolean(runId),
    staleTime: 5 * 60_000,
  });

  return {
    run: detailQuery.data ?? null,
    metrics: metricsQuery.data ?? null,
    report: reportQuery.data ?? null,
    isLoading: detailQuery.isLoading,
  };
}

export function useSimulationReplays(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.simulation.replays(params),
    queryFn: () => simulationApi.listReplays(params),
    staleTime: 20_000,
  });

  const start = useMutation({
    mutationFn: (payload) => simulationApi.startReplay(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulation', 'replays'] }),
  });

  const seek = useMutation({
    mutationFn: ({ replayId, ...payload }) =>
      simulationApi.seekReplay(replayId, payload),
  });

  const step = useMutation({
    mutationFn: (replayId) => simulationApi.stepReplay(replayId),
  });

  return {
    replays: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    startReplay: start.mutateAsync,
    seekReplay: seek.mutateAsync,
    stepReplay: step.mutateAsync,
  };
}