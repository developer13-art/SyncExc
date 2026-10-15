/**
 * SyncExc Server — Admin role service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createAdminRoleService({ db, queries, events, logger }) {
  async function listRoles() {
    const roles = await queries.listRoles();
    const result = [];
    for (const role of roles) {
      const permissions = await queries.listPermissionsForRole(role.id);
      result.push({ ...role, permissions });
    }
    return result;
  }

  async function listPermissions() {
    return queries.listPermissions();
  }

  async function createRole({ userId, name, description, permissions }) {
    if (!name || !description) {
      throw new ConflictError('name and description are required', 'MISSING_FIELDS');
    }
    const existing = await queries.findRoleByName(name);
    if (existing) throw new ConflictError('Role name is taken', 'ROLE_NAME_TAKEN');

    return db.tx(async (tx) => {
      const role = await queries.insertRole(tx, { name, description });

      for (const permissionKey of permissions || []) {
        const perm = await queries.findPermissionByKey(permissionKey);
        if (perm) {
          await queries.insertRolePermission(tx, {
            roleId: role.id,
            permissionId: perm.id,
          });
        }
      }

      await events.publish(
        tx,
        'admin.role_changed',
        { roleId: role.id, action: 'created', name },
        {
          actorId: userId,
          resourceType: 'admin_role',
          resourceId: role.id,
        }
      );

      return role;
    });
  }

  async function updateRole({ userId, roleId, description, permissions }) {
    const role = await queries.findRoleById(roleId);
    if (!role) throw new NotFoundError('Role');
    if (role.is_system) {
      throw new ConflictError('System roles cannot be modified', 'SYSTEM_ROLE');
    }

    return db.tx(async (tx) => {
      await queries.clearRolePermissions(roleId);

      for (const permissionKey of permissions || []) {
        const perm = await queries.findPermissionByKey(permissionKey);
        if (perm) {
          await queries.insertRolePermission(tx, {
            roleId,
            permissionId: perm.id,
          });
        }
      }

      await events.publish(
        tx,
        'admin.role_changed',
        { roleId, action: 'updated' },
        {
          actorId: userId,
          resourceType: 'admin_role',
          resourceId: roleId,
        }
      );

      return { ok: true };
    });
  }

  async function assignRole({ userId, targetUserId, roleId, scopeType, scopeId }) {
    const role = await queries.findRoleById(roleId);
    if (!role) throw new NotFoundError('Role');

    return db.tx(async (tx) => {
      const assignment = await queries.insertRoleAssignment(tx, {
        userId: targetUserId,
        roleId,
        scopeType,
        scopeId,
        assignedBy: userId,
      });

      await events.publish(
        tx,
        'admin.role_changed',
        { roleId, targetUserId, action: 'assigned' },
        {
          actorId: userId,
          resourceType: 'admin_role_assignment',
          resourceId: assignment.id,
        }
      );

      return assignment;
    });
  }

  async function revokeRole({ userId, assignmentId }) {
    const result = await queries.revokeRoleAssignment(assignmentId);
    if (!result) throw new NotFoundError('Assignment');

    await events.publish(db, 'admin.role_changed', {
      assignmentId,
      action: 'revoked',
    }, {
      actorId: userId,
      resourceType: 'admin_role_assignment',
      resourceId: assignmentId,
    });

    return result;
  }

  async function listAssignments(userId) {
    return queries.listRoleAssignmentsForUser(userId);
  }

  return {
    listRoles,
    listPermissions,
    createRole,
    updateRole,
    assignRole,
    revokeRole,
    listAssignments,
  };
}

export default createAdminRoleService;