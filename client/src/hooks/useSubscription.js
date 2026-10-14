import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { billingApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useSubscription() {
  const queryClient = useQueryClient();

  const subscriptionQuery = useQuery({
    queryKey: queryKeys.billing.subscription,
    queryFn: () => billingApi.getSubscription(),
    staleTime: 60_000,
  });

  const entitlementsQuery = useQuery({
    queryKey: queryKeys.billing.entitlements,
    queryFn: () => billingApi.getEntitlements(),
    staleTime: 60_000,
  });

  const usageQuery = useQuery({
    queryKey: queryKeys.billing.usage,
    queryFn: () => billingApi.getUsage(),
    staleTime: 30_000,
  });

  const changePlan = useMutation({
    mutationFn: (payload) => billingApi.changePlan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.subscription });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.entitlements });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.usage });
    },
  });

  const cancelSubscription = useMutation({
    mutationFn: (payload) => billingApi.cancelSubscription(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.subscription });
    },
  });

  const reactivate = useMutation({
    mutationFn: (payload) => billingApi.reactivateSubscription(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.subscription });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.entitlements });
    },
  });

  return {
    subscription: subscriptionQuery.data ?? null,
    entitlements: entitlementsQuery.data ?? {},
    usage: usageQuery.data ?? null,
    isLoading: subscriptionQuery.isLoading,
    changePlan: changePlan.mutateAsync,
    cancelSubscription: cancelSubscription.mutateAsync,
    reactivate: reactivate.mutateAsync,
    hasEntitlement: (key) => Boolean(entitlementsQuery.data?.[key]),
    getLimit: (key) => entitlementsQuery.data?.[key] ?? null,
  };
}