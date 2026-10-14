import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { workspacesApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';
import { useSelector } from 'react-redux';
import { selectActiveWorkspaceId } from '../features/settings/workspaceSlice.js';

export function usePermissions() {
  const workspaceId = useSelector(selectActiveWorkspaceId);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.workspaces.permissions(workspaceId),
    queryFn: () => workspacesApi.getMyPermissions(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  const permissions = useMemo(() => new Set(data?.permissions ?? []), [data]);

  const role = data?.role ?? null;

  const can = (permission) => {
    if (!permission) {
      return false;
    }
    if (Array.isArray(permission)) {
      return permission.some((p) => permissions.has(p));
    }
    return permissions.has(permission);
  };

  const canAll = (requiredPermissions) => {
    if (!Array.isArray(requiredPermissions)) {
      return false;
    }
    return requiredPermissions.every((p) => permissions.has(p));
  };

  const canAny = (anyPermissions) => {
    if (!Array.isArray(anyPermissions)) {
      return false;
    }
    return anyPermissions.some((p) => permissions.has(p));
  };

  return {
    permissions,
    role,
    isLoading,
    error,
    can,
    canAll,
    canAny,
  };
}