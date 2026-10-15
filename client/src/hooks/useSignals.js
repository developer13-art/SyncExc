import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { signalsApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useSignals(params = {}, enabled = true) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.signals.list(params),
    queryFn: () => signalsApi.listSignals(params),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const submitReview = useMutation({
    mutationFn: ({ signalId, ...payload }) => signalsApi.submitReview(signalId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signals'] }),
  });

  return {
    signals: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    submitReview: submitReview.mutateAsync,
  };
}

export function useSignal(signalId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.signals.detail(signalId),
    queryFn: () => signalsApi.getSignal(signalId),
    enabled: Boolean(signalId),
    staleTime: 15_000,
  });

  const versionsQuery = useQuery({
    queryKey: queryKeys.signals.versions(signalId),
    queryFn: () => signalsApi.listSignalVersions(signalId),
    enabled: Boolean(signalId),
    staleTime: 30_000,
  });

  const issuesQuery = useQuery({
    queryKey: queryKeys.signals.issues(signalId),
    queryFn: () => signalsApi.listSignalIssues(signalId),
    enabled: Boolean(signalId),
    staleTime: 30_000,
  });

  const eligibilityQuery = useQuery({
    queryKey: queryKeys.signals.eligibility(signalId),
    queryFn: () => signalsApi.getEligibility(signalId),
    enabled: Boolean(signalId),
    staleTime: 30_000,
  });

  const createIntent = useMutation({
    mutationFn: (payload) => signalsApi.createIntent(signalId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signals'] }),
  });

  return {
    signal: detailQuery.data ?? null,
    versions: versionsQuery.data ?? [],
    issues: issuesQuery.data ?? [],
    eligibility: eligibilityQuery.data ?? null,
    isLoading: detailQuery.isLoading,
    createIntent: createIntent.mutateAsync,
  };
}

export function useSignalMessages(params = {}) {
  const listQuery = useQuery({
    queryKey: queryKeys.signals.messages(params),
    queryFn: () => signalsApi.listMessages(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return {
    messages: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
  };
}

export function useSignalReviews(params = {}) {
  return useSignals({ ...params, needsReview: true });
}