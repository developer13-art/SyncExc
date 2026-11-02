import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { automationApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useWorkflows(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.automation.workflows(params),
    queryFn: () => automationApi.listWorkflows(params),
    staleTime: 20_000,
  });

  const create = useMutation({
    mutationFn: (payload) => automationApi.createWorkflow(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation'] }),
  });

  const pause = useMutation({
    mutationFn: ({ workflowId, ...payload }) =>
      automationApi.pauseWorkflow(workflowId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation'] }),
  });

  const resume = useMutation({
    mutationFn: ({ workflowId, ...payload }) =>
      automationApi.resumeWorkflow(workflowId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation'] }),
  });

  const retire = useMutation({
    mutationFn: ({ workflowId, ...payload }) =>
      automationApi.retireWorkflow(workflowId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation'] }),
  });

  return {
    workflows: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    createWorkflow: create.mutateAsync,
    pauseWorkflow: pause.mutateAsync,
    resumeWorkflow: resume.mutateAsync,
    retireWorkflow: retire.mutateAsync,
  };
}

export function useWorkflow(workflowId, { includeNodeCatalog = false } = {}) {
  const queryClient = useQueryClient();

  const nodeCatalogQuery = useQuery({
    queryKey: queryKeys.automation.nodeCatalog,
    queryFn: () => automationApi.listNodeCatalog(),
    enabled: includeNodeCatalog,
    staleTime: 5 * 60_000,
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.automation.workflow(workflowId),
    queryFn: () => automationApi.getWorkflow(workflowId),
    enabled: Boolean(workflowId),
    staleTime: 20_000,
  });

  const versionsQuery = useQuery({
    queryKey: queryKeys.automation.versions(workflowId),
    queryFn: () => automationApi.listVersions(workflowId),
    enabled: Boolean(workflowId),
    staleTime: 30_000,
  });

  const triggersQuery = useQuery({
    queryKey: queryKeys.automation.triggers(workflowId),
    queryFn: () => automationApi.listTriggers(workflowId),
    enabled: Boolean(workflowId),
    staleTime: 30_000,
  });

  const schedulesQuery = useQuery({
    queryKey: queryKeys.automation.schedules(workflowId),
    queryFn: () => automationApi.listSchedules(workflowId),
    enabled: Boolean(workflowId),
    staleTime: 30_000,
  });

  const currentVersion = versionsQuery.data?.find(
    (version) => Number(version.version) === Number(detailQuery.data?.currentVersion),
  ) ?? versionsQuery.data?.[0];
  const definition = currentVersion?.definition ?? { nodes: [], edges: [], input: {} };
  const workflow = detailQuery.data
    ? {
      ...detailQuery.data,
      definition,
      nodes: definition.nodes ?? [],
      edges: definition.edges ?? [],
    }
    : null;

  const update = useMutation({
    mutationFn: (payload) => automationApi.updateWorkflow(workflowId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.workflow(workflowId) });
    },
  });

  const validate = useMutation({
    mutationFn: (payload) => automationApi.validateWorkflow(workflowId, payload),
  });

  const publish = useMutation({
    mutationFn: (payload) => automationApi.publishWorkflow(workflowId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.versions(workflowId) });
    },
  });

  const activate = useMutation({
    mutationFn: (payload) => automationApi.activateWorkflow(workflowId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.workflow(workflowId) });
    },
  });

  return {
    workflow,
    nodeCatalog: nodeCatalogQuery.data ?? [],
    nodeCatalogError: nodeCatalogQuery.error,
    refetchNodeCatalog: nodeCatalogQuery.refetch,
    isBuilderLoading: detailQuery.isLoading || versionsQuery.isLoading || nodeCatalogQuery.isLoading,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
    versions: versionsQuery.data ?? [],
    triggers: triggersQuery.data ?? [],
    schedules: schedulesQuery.data ?? [],
    isLoading: detailQuery.isLoading,
    updateWorkflow: update.mutateAsync,
    validateWorkflow: validate.mutateAsync,
    publishWorkflow: publish.mutateAsync,
    activateWorkflow: activate.mutateAsync,
  };
}

export function useWorkflowRuns(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.automation.runs(params),
    queryFn: () => automationApi.listRuns(params),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const cancel = useMutation({
    mutationFn: ({ runId, ...payload }) => automationApi.cancelRun(runId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation', 'runs'] }),
  });

  return {
    runs: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    cancelRun: cancel.mutateAsync,
  };
}

export function useWorkflowRun(runId) {
  const detailQuery = useQuery({
    queryKey: queryKeys.automation.run(runId),
    queryFn: () => automationApi.getRun(runId),
    enabled: Boolean(runId),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const stepsQuery = useQuery({
    queryKey: queryKeys.automation.runSteps(runId),
    queryFn: () => automationApi.getRunSteps(runId),
    enabled: Boolean(runId),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  return {
    run: detailQuery.data ?? null,
    steps: stepsQuery.data ?? [],
    isLoading: detailQuery.isLoading,
  };
}

export function useWorkflowTemplates(params = {}) {
  const listQuery = useQuery({
    queryKey: queryKeys.automation.templates(params),
    queryFn: () => automationApi.listTemplates(params),
    staleTime: 5 * 60_000,
  });

  return {
    templates: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
  };
}