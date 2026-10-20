import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { workspacesApi } from '../api/index.js';
import { queryKeys } from '../hooks/queryKeys.js';
import {
  workspaceActions,
  selectActiveWorkspaceId,
  selectWorkspaces,
} from '../features/settings/workspaceSlice.js';
import { selectIsAuthenticated } from '../features/auth/authSlice.js';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const workspaces = useSelector(selectWorkspaces);
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId);

  const listQuery = useQuery({
    queryKey: queryKeys.workspaces.list({}),
    queryFn: () => workspacesApi.list({ pageSize: 100 }),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (listQuery.data?.items) {
      dispatch(workspaceActions.workspacesLoaded(listQuery.data.items));
    }
  }, [listQuery.data, dispatch]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  const permissionsQuery = useQuery({
    queryKey: queryKeys.workspaces.permissions(activeWorkspaceId),
    queryFn: () => workspacesApi.getMyPermissions(activeWorkspaceId),
    enabled:
      isAuthenticated &&
      listQuery.isSuccess &&
      Boolean(activeWorkspace),
    staleTime: 60_000,
  });

  const switchWorkspace = useCallback(
    async (workspaceId) => {
      if (workspaceId === activeWorkspaceId) {
        return;
      }
      const cachedWorkspaceList = queryClient.getQueryData(queryKeys.workspaces.list({}));
      const targetWorkspace =
        workspaces.find((workspace) => workspace.id === workspaceId) ??
        cachedWorkspaceList?.items?.find((workspace) => workspace.id === workspaceId);
      if (!targetWorkspace || targetWorkspace.status !== 'active') {
        throw new Error('This workspace is unavailable.');
      }

      await queryClient.cancelQueries();
      queryClient.clear();
      dispatch(workspaceActions.setActiveWorkspace(workspaceId));
    },
    [activeWorkspaceId, dispatch, queryClient, workspaces],
  );

  const reloadWorkspaces = useCallback(async () => {
    const result = await workspacesApi.list({ pageSize: 100 });
    dispatch(workspaceActions.workspacesLoaded(result.items));
    await queryClient.invalidateQueries({
      queryKey: queryKeys.workspaces.permissions(activeWorkspaceId),
    });
    return result.items;
  }, [activeWorkspaceId, dispatch, queryClient]);

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

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      permissions: permissionsQuery.data?.permissions ?? [],
      isLoading: listQuery.isLoading || (Boolean(activeWorkspace) && permissionsQuery.isLoading),
      isWorkspaceReady:
        listQuery.isSuccess && Boolean(activeWorkspace) && permissionsQuery.isSuccess,
      error: listQuery.error ?? permissionsQuery.error,
      switchWorkspace,
      reloadWorkspaces,
      createWorkspace: createWorkspace.mutateAsync,
      updateWorkspace: updateWorkspace.mutateAsync,
      isCreating: createWorkspace.isPending,
      isUpdating: updateWorkspace.isPending,
    }),
    [
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      listQuery.isLoading,
      listQuery.isSuccess,
      listQuery.error,
      permissionsQuery.data,
      permissionsQuery.isLoading,
      permissionsQuery.isSuccess,
      permissionsQuery.error,
      switchWorkspace,
      reloadWorkspaces,
      createWorkspace.mutateAsync,
      createWorkspace.isPending,
      updateWorkspace.mutateAsync,
      updateWorkspace.isPending,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return ctx;
}