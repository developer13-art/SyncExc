/**
 * SyncExc Server — Authorization middleware
 *
 * Three middlewares:
 *
 *   requireWorkspace        → resolves workspace from header or params, verifies membership
 *   requirePermission(perm) → checks a single permission against the member's role
 *   requireEntitlement(key) → checks a subscription entitlement
 *
 * Workspace resolution precedence:
 *   1. `X-Workspace-Id` header
 *   2. `:workspaceId` route param
 *   3. `body.workspaceId`
 *   4. `query.workspaceId`
 *
 * If a user is a member of the workspace, `req.workspace` is populated.
 * Permissions come from the role definition plus any extra grants.
 */

import { AuthorizationError, NotFoundError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ component: 'permission' });

/* =============================================================================
 * WORKSPACE RESOLUTION
 * ========================================================================== */

function extractWorkspaceId(req) {
  return (
    req.headers['x-workspace-id'] ||
    req.params?.workspaceId ||
    req.body?.workspaceId ||
    req.query?.workspaceId ||
    null
  );
}

/**
 * Resolve and authorize the active workspace.
 *
 * @param {Object} opts
 * @param {boolean} [opts.required=true]  If false, requests without workspace context are allowed.
 */
export function requireWorkspace({ required = true } = {}) {
  return async function requireWorkspaceMiddleware(req, _res, next) {
    if (!req.auth?.isAuthenticated) {
      return next(new AuthorizationError('Authentication required'));
    }

    const workspaceId = extractWorkspaceId(req);
    if (!workspaceId) {
      if (required) {
        return next(new AuthorizationError('Workspace context is required', 'WORKSPACE_REQUIRED'));
      }
      return next();
    }

    try {
      const { workspaces } = req.services;
      const membership = await workspaces.getMembership({
        userId: req.auth.userId,
        workspaceId,
      });

      if (!membership || membership.status !== 'active') {
        throw new NotFoundError('Workspace');
      }

      const workspace = await workspaces.getWorkspaceById(workspaceId);
      if (!workspace || workspace.status === 'closed') {
        throw new NotFoundError('Workspace');
      }

      const effectivePermissions = await workspaces.getEffectivePermissions({
        userId: req.auth.userId,
        workspaceId,
      });

      req.workspace = {
        id: workspace.id,
        role: membership.role,
        permissions: effectivePermissions,
        member: membership,
        workspace,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

/* =============================================================================
 * PERMISSION CHECKS
 * ========================================================================== */

/**
 * Require a specific permission on the active workspace.
 * Must be applied after `requireWorkspace`.
 */
export function requirePermission(permission) {
  return function requirePermissionMiddleware(req, _res, next) {
    if (!req.workspace?.id) {
      return next(new AuthorizationError('Workspace context is required', 'WORKSPACE_REQUIRED'));
    }
    if (!req.workspace.permissions.includes(permission)) {
      logger.debug(
        {
          userId: req.auth?.userId,
          workspaceId: req.workspace.id,
          permission,
        },
        'Permission denied'
      );
      return next(new AuthorizationError(`Missing permission: ${permission}`, 'PERMISSION_DENIED'));
    }
    next();
  };
}

/**
 * Require any one of the listed permissions.
 */
export function requireAnyPermission(...permissions) {
  return function requireAnyPermissionMiddleware(req, _res, next) {
    if (!req.workspace?.id) {
      return next(new AuthorizationError('Workspace context is required', 'WORKSPACE_REQUIRED'));
    }
    const has = permissions.some((p) => req.workspace.permissions.includes(p));
    if (!has) {
      return next(
        new AuthorizationError(
          `Missing one of: ${permissions.join(', ')}`,
          'PERMISSION_DENIED'
        )
      );
    }
    next();
  };
}

/**
 * Require every listed permission.
 */
export function requireAllPermissions(...permissions) {
  return function requireAllPermissionsMiddleware(req, _res, next) {
    if (!req.workspace?.id) {
      return next(new AuthorizationError('Workspace context is required', 'WORKSPACE_REQUIRED'));
    }
    const missing = permissions.filter((p) => !req.workspace.permissions.includes(p));
    if (missing.length > 0) {
      return next(
        new AuthorizationError(`Missing permissions: ${missing.join(', ')}`, 'PERMISSION_DENIED')
      );
    }
    next();
  };
}

/* =============================================================================
 * ROLE CHECKS
 * ========================================================================== */

export function requireRole(...roles) {
  return function requireRoleMiddleware(req, _res, next) {
    if (!req.workspace?.id) {
      return next(new AuthorizationError('Workspace context is required', 'WORKSPACE_REQUIRED'));
    }
    if (!roles.includes(req.workspace.role)) {
      return next(
        new AuthorizationError(
          `Requires role: ${roles.join(' or ')}`,
          'ROLE_REQUIRED'
        )
      );
    }
    next();
  };
}

/* =============================================================================
 * ENTITLEMENTS
 * ========================================================================== */

/**
 * Require a subscription entitlement.
 * The scope is the workspace unless overridden by the route.
 */
export function requireEntitlement(featureKey, { scope = 'workspace' } = {}) {
  return async function requireEntitlementMiddleware(req, _res, next) {
    try {
      const scopeId =
        scope === 'workspace' ? req.workspace?.id : req.auth?.userId;

      if (!scopeId) {
        return next(new AuthorizationError('Scope context is required', 'SCOPE_REQUIRED'));
      }

      const { billing } = req.services;
      const result = await billing.checkEntitlement({
        scopeType: scope,
        scopeId,
        featureKey,
      });

      if (!result.allowed) {
        return next(
          new AuthorizationError(
            `Feature not available on current plan: ${featureKey}`,
            'ENTITLEMENT_REQUIRED'
          )
        );
      }

      req.entitlement = result;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/* =============================================================================
 * FEATURE FLAGS
 * ========================================================================== */

/**
 * Require a platform feature flag to be enabled for the current context.
 * Feature flags are checked from the admin service with targeting rules
 * applied.
 */
export function requireFeatureFlag(flagKey) {
  return async function requireFeatureFlagMiddleware(req, _res, next) {
    try {
      const { admin } = req.services;
      const enabled = await admin.isFeatureEnabled({
        key: flagKey,
        userId: req.auth?.userId || null,
        workspaceId: req.workspace?.id || null,
      });
      if (!enabled) {
        return next(new NotFoundError('Feature'));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/* =============================================================================
 * SELF-OWNERSHIP
 * ========================================================================== */

/**
 * Require that the request is acting on the user's own record.
 * Compares `req.params.userId` (or body) to `req.auth.userId`.
 */
export function requireSelf({ param = 'userId' } = {}) {
  return function requireSelfMiddleware(req, _res, next) {
    const targetId = req.params?.[param] || req.body?.[param];
    if (!targetId || targetId === req.auth?.userId) return next();
    return next(new AuthorizationError('You may only act on your own account', 'NOT_SELF'));
  };
}

export default {
  requireWorkspace,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  requireEntitlement,
  requireFeatureFlag,
  requireSelf,
};