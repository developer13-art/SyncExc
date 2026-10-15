/**
 * SyncExc Server — Admin permission service
 *
 * Central authorization check for every admin action. No admin screen or
 * endpoint may bypass it.
 */

import { AuthorizationError } from '../../lib/errors.js';

export function createAdminPermissionService({ db, queries, logger }) {
  /**
   * Get the effective permission set for an admin user.
   */
  async function getEffectivePermissions(userId) {
    const assignments = await queries.listRoleAssignmentsForUser(userId);
    if (assignments.length === 0) return { permissions: new Set(), roles: [] };

    const permissions = new Set();
    const roles = [];

    for (const assignment of assignments) {
      roles.push(assignment.role_name);

      const rolePermissions = await queries.listPermissionsForRole(assignment.role_id);
      for (const p of rolePermissions) {
        permissions.add(p.permission_key);
      }

      // Wildcard role (platform_administrator) grants everything
      if (rolePermissions.some((p) => p.permission_key === '*')) {
        const all = await queries.listPermissions();
        for (const p of all) permissions.add(p.permission_key);
        permissions.add('*');
      }
    }

    // Apply access grants (temporary elevated permissions)
    const grants = await queries.listActiveAccessGrants(userId);
    for (const grant of grants) {
      for (const p of grant.permissions || []) {
        permissions.add(p);
      }
    }

    return { permissions, roles };
  }

  async function has(userId, permission) {
    const { permissions } = await getEffectivePermissions(userId);
    return permissions.has(permission) || permissions.has('*');
  }

  async function hasAll(userId, requiredPermissions) {
    const { permissions } = await getEffectivePermissions(userId);
    if (permissions.has('*')) return true;
    return requiredPermissions.every((p) => permissions.has(p));
  }

  async function require(userId, permission) {
    const hasIt = await has(userId, permission);
    if (!hasIt) {
      logger.warn({ userId, permission }, 'Admin permission denied');
      throw new AuthorizationError(
        `Missing admin permission: ${permission}`,
        'ADMIN_PERMISSION_DENIED'
      );
    }
  }

  async function requireAny(userId, permissions) {
    const { permissions: held } = await getEffectivePermissions(userId);
    if (held.has('*')) return;
    const hasAny = permissions.some((p) => held.has(p));
    if (!hasAny) {
      throw new AuthorizationError(
        `Missing one of: ${permissions.join(', ')}`,
        'ADMIN_PERMISSION_DENIED'
      );
    }
  }

  return {
    getEffectivePermissions,
    has,
    hasAll,
    require,
    requireAny,
  };
}

export default createAdminPermissionService;