/**
 * SyncExc Server — Admin console routes
 *
 * Mounted under /admin/console after the admin authentication middleware.
 * Permissions are resolved per resource from the registry, so a page and its
 * actions always require the section permission they declare.
 */

import { Router } from 'express';
import { NotFoundError } from '../../lib/errors.js';
import { getResource } from './console/registry.js';
import { createConsoleController } from './console.controller.js';

export function createConsoleRoutes({
  queryService,
  actionService,
  systemService,
  analyticsService,
  permissionService,
  middleware,
}) {
  const router = Router();
  const controller = createConsoleController({
    query: queryService,
    action: actionService,
    system: systemService,
    analytics: analyticsService,
    permission: permissionService,
  });

  function requireResource(kind = 'view') {
    return async function requireResourceMiddleware(req, _res, next) {
      const resource = getResource(req.params.resourceKey);
      if (!resource) return next(new NotFoundError('Admin resource'));
      req.consoleResource = resource;
      try {
        await permissionService.require(
          req.auth.userId,
          kind === 'manage' ? resource.managePermission : resource.viewPermission,
        );
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  function requireSectionView(paramName) {
    return async function requireSectionViewMiddleware(req, _res, next) {
      try {
        await permissionService.require(
          req.auth.userId,
          `admin.${req.params[paramName]}.view`,
        );
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /* Page definitions */
  router.get(
    '/pages/:sectionId/:pageId',
    requireSectionView('sectionId'),
    middleware.asyncHandler(controller.getPage),
  );

  /* Resource catalog */
  router.get(
    '/resources',
    middleware.asyncHandler(controller.listResourceDefinitions),
  );

  /* System and analytics */
  router.get(
    '/system/overview',
    middleware.requireAdminPermission('admin.infrastructure.view'),
    middleware.asyncHandler(controller.getSystem),
  );

  router.get(
    '/analytics/:sectionId',
    requireSectionView('sectionId'),
    middleware.asyncHandler(controller.getAnalytics),
  );

  /* Collection actions (e.g. creating finance adjustments) */
  router.post(
    '/resources/:resourceKey/actions/:actionKey',
    requireResource('manage'),
    middleware.asyncHandler(controller.performAction),
  );

  /* Resource list */
  router.get(
    '/resources/:resourceKey',
    requireResource('view'),
    middleware.asyncHandler(controller.list),
  );

  /* Resource summaries, exports and detail */
  router.get(
    '/resources/:resourceKey/summary',
    requireResource('view'),
    middleware.asyncHandler(controller.summary),
  );

  router.get(
    '/resources/:resourceKey/export',
    requireResource('view'),
    middleware.asyncHandler(controller.exportCsv),
  );

  router.get(
    '/resources/:resourceKey/:id',
    requireResource('view'),
    middleware.asyncHandler(controller.detail),
  );

  router.post(
    '/resources/:resourceKey/:id/actions/:actionKey',
    requireResource('manage'),
    middleware.asyncHandler(controller.performAction),
  );

  router.post(
    '/resources/:resourceKey/:id/notes',
    requireResource('view'),
    middleware.asyncHandler(controller.addNote),
  );

  return router;
}

export default createConsoleRoutes;
