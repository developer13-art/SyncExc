import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';

import { workspacesApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';
import {
  workspaceActions,
  selectActiveWorkspaceId,
  selectWorkspaces,
} from '../features/settings/workspaceSlice.js';

export function useWorkspace() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId);
  const workspaces = useSelector(selectWorkspaces);

  const listQuery = useQuery({
    queryKey: queryKeys.workspaces.list({}),
    queryFn: () => workspacesApi.list({ pageSize: 100 }),
    staleTime: 5 * 60_000,
  });

  const activeWorkspace = useMemo(() => {
    if (!activeWorkspaceId) {
      return null;
    }
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  }, [activeWorkspaceId, workspaces]);

  const detailQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(activeWorkspaceId),
    queryFn: () => workspacesApi.getById(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId) && !activeWorkspace,
  });

  const switchWorkspace = useCallback(
    async (workspaceId) => {
      dispatch(workspaceActions.setActiveWorkspace(workspaceId));
      await workspacesApi.switchContext(workspaceId).catch(() => null);
      queryClient.invalidateQueries();
    },
    [dispatch, queryClient],
  );

  const createWorkspace = useMutation({
    mutationFn: (payload) => workspacesApi.create(payload),
    onSuccess: (workspace) => {
      dispatch(workspaceActions.workspaceAdded(workspace));
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });

  const updateWorkspace = useMutation({
    mutationFn: ({ workspaceId, ...payload }) => workspacesApi.update(workspaceId, payload),
    onSuccess: (workspace) => {
      dispatch(workspaceActions.workspaceUpdated(workspace));
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.detail(workspace.id),
      });
    },
  });

  return {
    workspaces,
    activeWorkspace: activeWorkspace ?? detailQuery.data ?? null,
    activeWorkspaceId,
    isLoading: listQuery.isLoading,
    switchWorkspace,
    createWorkspace: createWorkspace.mutateAsync,
    updateWorkspace: updateWorkspace.mutateAsync,
    isCreating: createWorkspace.isPending,
    isUpdating: updateWorkspace.isPending,
  };
}