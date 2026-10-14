import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sourcesApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useSources(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.sources.list(params),
    queryFn: () => sourcesApi.list(params),
    staleTime: 30_000,
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.sources.categories,
    queryFn: () => sourcesApi.listCategories(),
    staleTime: 5 * 60_000,
  });

  const create = useMutation({
    mutationFn: (payload) => sourcesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sources.all }),
  });

  const enable = useMutation({
    mutationFn: (sourceId) => sourcesApi.enable(sourceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sources.all }),
  });

  const pause = useMutation({
    mutationFn: ({ sourceId, ...payload }) => sourcesApi.pause(sourceId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sources.all }),
  });

  const archive = useMutation({
    mutationFn: ({ sourceId, ...payload }) => sourcesApi.archive(sourceId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sources.all }),
  });

  return {
    sources: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    categories: categoriesQuery.data ?? [],
    isLoading: listQuery.isLoading,
    createSource: create.mutateAsync,
    enableSource: enable.mutateAsync,
    pauseSource: pause.mutateAsync,
    archiveSource: archive.mutateAsync,
  };
}

export function useSource(sourceId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.sources.detail(sourceId),
    queryFn: () => sourcesApi.getById(sourceId),
    enabled: Boolean(sourceId),
    staleTime: 30_000,
  });

  const healthQuery = useQuery({
    queryKey: queryKeys.sources.health(sourceId),
    queryFn: () => sourcesApi.getHealth(sourceId),
    enabled: Boolean(sourceId),
    refetchInterval: 60_000,
  });

  const qualityQuery = useQuery({
    queryKey: queryKeys.sources.quality(sourceId),
    queryFn: () => sourcesApi.getQuality(sourceId),
    enabled: Boolean(sourceId),
    staleTime: 60_000,
  });

  const connectionQuery = useQuery({
    queryKey: queryKeys.sources.connection(sourceId),
    queryFn: () => sourcesApi.getConnection(sourceId),
    enabled: Boolean(sourceId),
    staleTime: 30_000,
  });

  const revalidate = useMutation({
    mutationFn: (payload) => sourcesApi.revalidate(sourceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.detail(sourceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.health(sourceId) });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => sourcesApi.testConnection(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.connection(sourceId) });
    },
  });

  return {
    source: detailQuery.data ?? null,
    health: healthQuery.data ?? null,
    quality: qualityQuery.data ?? null,
    connection: connectionQuery.data ?? null,
    isLoading: detailQuery.isLoading,
    revalidate: revalidate.mutateAsync,
    testConnection: testConnection.mutateAsync,
  };
}

export function useSourceDiscovery(params = {}) {
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: queryKeys.sources.discoveryJobs(params),
    queryFn: () => sourcesApi.listDiscoveryJobs(params),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (payload) => sourcesApi.createDiscoveryJob(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['sources', 'discovery-jobs'] }),
  });

  const cancel = useMutation({
    mutationFn: (jobId) => sourcesApi.cancelDiscoveryJob(jobId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['sources', 'discovery-jobs'] }),
  });

  return {
    jobs: jobsQuery.data?.items ?? [],
    meta: jobsQuery.data?.meta ?? {},
    isLoading: jobsQuery.isLoading,
    createJob: create.mutateAsync,
    cancelJob: cancel.mutateAsync,
  };
}

export function useSourceCandidates(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.sources.candidates(params),
    queryFn: () => sourcesApi.listCandidates(params),
    staleTime: 30_000,
  });

  const register = useMutation({
    mutationFn: ({ candidateId, ...payload }) =>
      sourcesApi.registerCandidate(candidateId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['sources', 'candidates'] }),
  });

  return {
    candidates: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    registerCandidate: register.mutateAsync,
  };
}