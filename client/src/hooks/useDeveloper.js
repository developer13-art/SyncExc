import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { developerApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useDeveloperApplications(params = {}) {
  const queryClient = useQueryClient();
  const { enabled = true, ...queryParams } = params;

  const listQuery = useQuery({
    queryKey: queryKeys.developer.applications(queryParams),
    queryFn: () => developerApi.listApplications(queryParams),
    enabled,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (payload) => developerApi.createApplication(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['developer'] }),
  });

  return {
    applications: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,
    createApplication: create.mutateAsync,
  };
}

export function useDeveloperApplication(applicationId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.developer.application(applicationId),
    queryFn: () => developerApi.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 30_000,
  });

  const credentialsQuery = useQuery({
    queryKey: queryKeys.developer.credentials(applicationId),
    queryFn: () => developerApi.listCredentials(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 30_000,
  });

  const webhooksQuery = useQuery({
    queryKey: queryKeys.developer.webhooks(applicationId),
    queryFn: () => developerApi.listWebhooks(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 30_000,
  });

  const update = useMutation({
    mutationFn: (payload) => developerApi.updateApplication(applicationId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.developer.application(applicationId),
      }),
  });

  const createCredential = useMutation({
    mutationFn: (payload) => developerApi.createCredential(applicationId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.developer.credentials(applicationId),
      }),
  });

  const rotateCredential = useMutation({
    mutationFn: ({ credentialId, ...payload }) =>
      developerApi.rotateCredential(applicationId, credentialId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.developer.credentials(applicationId),
      }),
  });

  const revokeCredential = useMutation({
    mutationFn: (credentialId) =>
      developerApi.revokeCredential(applicationId, credentialId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.developer.credentials(applicationId),
      }),
  });

  const createWebhook = useMutation({
    mutationFn: (payload) => developerApi.createWebhook(applicationId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.developer.webhooks(applicationId),
      }),
  });

  const deleteWebhook = useMutation({
    mutationFn: (subscriptionId) =>
      developerApi.deleteWebhook(applicationId, subscriptionId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.developer.webhooks(applicationId),
      }),
  });

  return {
    application: detailQuery.data ?? null,
    credentials: credentialsQuery.data ?? [],
    webhooks: webhooksQuery.data ?? [],
    isLoading: detailQuery.isLoading,
    updateApplication: update.mutateAsync,
    createCredential: createCredential.mutateAsync,
    rotateCredential: rotateCredential.mutateAsync,
    revokeCredential: revokeCredential.mutateAsync,
    createWebhook: createWebhook.mutateAsync,
    deleteWebhook: deleteWebhook.mutateAsync,
  };
}

export function useWebhookDeliveries(applicationId, subscriptionId, params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.developer.webhookDeliveries(
      applicationId,
      subscriptionId,
      params,
    ),
    queryFn: () =>
      developerApi.listWebhookDeliveries(applicationId, subscriptionId, params),
    enabled: Boolean(applicationId) && Boolean(subscriptionId),
    staleTime: 15_000,
  });

  const replay = useMutation({
    mutationFn: (payload) =>
      developerApi.replayDelivery(applicationId, subscriptionId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['developer', 'webhook-deliveries'],
      }),
  });

  return {
    deliveries: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    replayDelivery: replay.mutateAsync,
  };
}