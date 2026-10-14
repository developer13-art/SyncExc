import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { selectCurrentAdmin } from '../features/auth/selector.js';

export function usePermissions() {
  const admin = useSelector(selectCurrentAdmin);

  const permissions = useMemo(
    () => new Set(admin?.permissions ?? []),
    [admin?.permissions],
  );

  const roles = useMemo(() => new Set(admin?.roles ?? []), [admin?.roles]);

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

  const hasRole = (role) => {
    if (!role) {
      return false;
    }
    if (Array.isArray(role)) {
      return role.some((r) => roles.has(r));
    }
    return roles.has(role);
  };

  return {
    permissions,
    roles,
    isLoading: false,
    can,
    canAll,
    canAny,
    hasRole,
  };
}