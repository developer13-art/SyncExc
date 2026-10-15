import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { riskApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useRiskPolicies(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.risk.policies(params),
    queryFn: () => riskApi.listPolicies(params),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (payload) => riskApi.createPolicy(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk', 'policies'] }),
  });

  const activate = useMutation({
    mutationFn: ({ policyId, ...payload }) => riskApi.activatePolicy(policyId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk'] }),
  });

  const suspend = useMutation({
    mutationFn: ({ policyId, ...payload }) => riskApi.suspendPolicy(policyId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk'] }),
  });

  return {
    policies: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    createPolicy: create.mutateAsync,
    activatePolicy: activate.mutateAsync,
    suspendPolicy: suspend.mutateAsync,
  };
}

export function useRiskPolicy(policyId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.risk.policy(policyId),
    queryFn: () => riskApi.getPolicy(policyId),
    enabled: Boolean(policyId),
    staleTime: 30_000,
  });

  const versionsQuery = useQuery({
    queryKey: queryKeys.risk.policyVersions(policyId),
    queryFn: () => riskApi.listPolicyVersions(policyId),
    enabled: Boolean(policyId),
    staleTime: 60_000,
  });

  const update = useMutation({
    mutationFn: (payload) => riskApi.updatePolicy(policyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risk.policy(policyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.risk.policyVersions(policyId) });
    },
  });

  return {
    policy: detailQuery.data ?? null,
    versions: versionsQuery.data ?? [],
    isLoading: detailQuery.isLoading,
    updatePolicy: update.mutateAsync,
  };
}

export function useRiskExposure(params = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.risk.exposure(params),
    queryFn: () => riskApi.getExposure(params),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useRiskApprovals(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.risk.approvals(params),
    queryFn: () => riskApi.listApprovals(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const approve = useMutation({
    mutationFn: ({ approvalId, ...payload }) => riskApi.approve(approvalId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk', 'approvals'] }),
  });

  const reject = useMutation({
    mutationFn: ({ approvalId, ...payload }) => riskApi.reject(approvalId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk', 'approvals'] }),
  });

  const revoke = useMutation({
    mutationFn: ({ approvalId, ...payload }) => riskApi.revokeApproval(approvalId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk', 'approvals'] }),
  });

  return {
    approvals: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    approve: approve.mutateAsync,
    reject: reject.mutateAsync,
    revoke: revoke.mutateAsync,
  };
}

export function useRiskAlerts(params = {}, enabled = true) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.risk.alerts(params),
    queryFn: () => riskApi.listAlerts(params),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const acknowledge = useMutation({
    mutationFn: ({ alertId, ...payload }) => riskApi.acknowledgeAlert(alertId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk', 'alerts'] }),
  });

  return {
    alerts: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    acknowledge: acknowledge.mutateAsync,
  };
}

export function useRiskIncidents(params = {}) {
  const listQuery = useQuery({
    queryKey: queryKeys.risk.incidents(params),
    queryFn: () => riskApi.listIncidents(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return {
    incidents: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
  };
}

export function useEmergencyPause() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: queryKeys.risk.emergencyStatus,
    queryFn: () => riskApi.getEmergencyStatus(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const requestPause = useMutation({
    mutationFn: (payload) => riskApi.requestEmergencyPause(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risk.emergencyStatus });
    },
  });

  const resume = useMutation({
    mutationFn: ({ pauseId, ...payload }) => riskApi.resumeEmergency(pauseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risk.emergencyStatus });
    },
  });

  return {
    status: statusQuery.data ?? null,
    isLoading: statusQuery.isLoading,
    requestPause: requestPause.mutateAsync,
    resume: resume.mutateAsync,
  };
}