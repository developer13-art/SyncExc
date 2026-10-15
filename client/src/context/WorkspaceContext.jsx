import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
      dispatch(workspaceActions.setActiveWorkspace(workspaceId));
      try {
        await workspacesApi.switchContext(workspaceId);
      } catch {
        // Server switch-context may not be required in all deployments.
      }
      await queryClient.invalidateQueries();
    },
    [activeWorkspaceId, dispatch, queryClient],
  );

  const reloadWorkspaces = useCallback(async () => {
    const result = await workspacesApi.list({ pageSize: 100 });
    dispatch(workspaceActions.workspacesLoaded(result.items));
    await queryClient.invalidateQueries({
      queryKey: queryKeys.workspaces.permissions(activeWorkspaceId),
    });
    return result.items;
  }, [activeWorkspaceId, dispatch, queryClient]);

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