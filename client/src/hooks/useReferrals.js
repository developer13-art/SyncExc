import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { referralApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useReferralProfile() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: queryKeys.referral.profile,
    queryFn: () => referralApi.getProfile(),
    staleTime: 60_000,
  });

  const enroll = useMutation({
    mutationFn: (payload) => referralApi.enroll(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referral'] }),
  });

  return {
    profile: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    enroll: enroll.mutateAsync,
    isEnrolled: Boolean(profileQuery.data?.status && profileQuery.data.status !== 'not_enrolled'),
  };
}

export function useReferralDashboard() {
  const profileQuery = useQuery({
    queryKey: queryKeys.referral.profile,
    queryFn: () => referralApi.getProfile(),
    staleTime: 60_000,
  });

  const dashboardQuery = useQuery({
    queryKey: queryKeys.referral.dashboard,
    queryFn: () => referralApi.getDashboard(),
    enabled: Boolean(profileQuery.data),
    staleTime: 30_000,
  });

  return {
    ...dashboardQuery,
    data: profileQuery.data ? dashboardQuery.data : null,
    isLoading:
      profileQuery.isLoading ||
      (Boolean(profileQuery.data) && dashboardQuery.isLoading),
    error: profileQuery.error ?? dashboardQuery.error,
  };
}

export function useReferralLinks(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.referral.links(params),
    queryFn: () => referralApi.listLinks(params),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (payload) => referralApi.createLink(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referral', 'links'] }),
  });

  const pause = useMutation({
    mutationFn: ({ linkId, ...payload }) => referralApi.pauseLink(linkId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referral', 'links'] }),
  });

  const resume = useMutation({
    mutationFn: ({ linkId, ...payload }) => referralApi.resumeLink(linkId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referral', 'links'] }),
  });

  const revoke = useMutation({
    mutationFn: ({ linkId, ...payload }) => referralApi.revokeLink(linkId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referral', 'links'] }),
  });

  return {
    links: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error,
    refetch: listQuery.refetch,
    createLink: create.mutateAsync,
    pauseLink: pause.mutateAsync,
    resumeLink: resume.mutateAsync,
    revokeLink: revoke.mutateAsync,
  };
}

export function useCommissions(params = {}) {
  const listQuery = useQuery({
    queryKey: queryKeys.referral.commissions(params),
    queryFn: () => referralApi.listCommissions(params),
    staleTime: 30_000,
  });

  return {
    commissions: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
  };
}

export function useLedger(params = {}) {
  const listQuery = useQuery({
    queryKey: queryKeys.referral.ledger(params),
    queryFn: () => referralApi.getLedger(params),
    staleTime: 30_000,
  });

  return {
    entries: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
  };
}

export function usePayouts(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.referral.payouts(params),
    queryFn: () => referralApi.listPayouts(params),
    staleTime: 30_000,
  });

  const requestPayout = useMutation({
    mutationFn: (payload) => referralApi.requestPayout(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referral', 'payouts'] }),
  });

  const cancelPayout = useMutation({
    mutationFn: ({ payoutId, ...payload }) => referralApi.cancelPayout(payoutId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referral', 'payouts'] }),
  });

  return {
    payouts: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    requestPayout: requestPayout.mutateAsync,
    cancelPayout: cancelPayout.mutateAsync,
  };
}

export function usePayoutMethods() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.referral.payoutMethods,
    queryFn: () => referralApi.listPayoutMethods(),
    staleTime: 60_000,
  });

  const add = useMutation({
    mutationFn: (payload) => referralApi.addPayoutMethod(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referral', 'payout-methods'] }),
  });

  const disable = useMutation({
    mutationFn: (methodId) => referralApi.disablePayoutMethod(methodId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referral', 'payout-methods'] }),
  });

  return {
    methods: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    addMethod: add.mutateAsync,
    disableMethod: disable.mutateAsync,
  };
}