/**
 * SyncExc Server — Connections routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  CreateConnectionRequestSchema,
  RotateCredentialsRequestSchema,
  SuspendConnectionRequestSchema,
  UuidSchema,
} from '@syncexc/shared';
import { createConnectionsController } from './connections.controller.js';

export function createConnectionsRoutes({ service, middleware }) {
  const controller = createConnectionsController({ service });
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Exchanges (public catalog)
   * ------------------------------------------------------------------------ */
  router.get(
    '/exchanges',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listExchanges)
  );

  router.get(
    '/exchanges/:exchangeCode/connection-requirements',
    middleware.optionalAuth(),
    middleware.validateParams(
      Joi.object({
        exchangeCode: Joi.string().valid('binance', 'bybit', 'bitget', 'okx').required(),
      }),
    ),
    middleware.asyncHandler(controller.getConnectionRequirements)
  );

  router.get(
    '/exchanges/:exchangeCode/instruments',
    middleware.optionalAuth(),
    middleware.validateQuery(Joi.object({
      marketType: Joi.string().valid('spot', 'futures', 'perpetual').optional(),
    })),
    middleware.asyncHandler((req, res) => {
      req.query.exchange = req.params.exchangeCode;
      return controller.listInstruments(req, res);
    })
  );

  /* ---------------------------------------------------------------------------
   * Connections
   * ------------------------------------------------------------------------ */
  router.get(
    '/',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.view'),
    middleware.asyncHandler(controller.listConnections)
  );

  router.post(
    '/',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.create'),
    middleware.validateBody(CreateConnectionRequestSchema),
    middleware.asyncHandler(controller.createConnection)
  );

  router.get(
    '/:connectionId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.view'),
    middleware.validateParams(Joi.object({ connectionId: UuidSchema.required() })),
    middleware.asyncHandler(controller.getConnection)
  );

  router.post(
    '/:connectionId/test',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.view'),
    middleware.asyncHandler(controller.testConnection)
  );

  router.post(
    '/:connectionId/sync',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.update'),
    middleware.validateParams(Joi.object({ connectionId: UuidSchema.required() })),
    middleware.asyncHandler(controller.syncConnection)
  );

  router.post(
    '/:connectionId/rotate-credentials',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.update'),
    middleware.requireStepUp(),
    middleware.validateBody(RotateCredentialsRequestSchema),
    middleware.asyncHandler(controller.rotateCredentials)
  );

  router.post(
    '/:connectionId/suspend',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.update'),
    middleware.validateBody(SuspendConnectionRequestSchema),
    middleware.asyncHandler(controller.suspendConnection)
  );

  router.post(
    '/:connectionId/disconnect',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.disconnect'),
    middleware.requireStepUp(),
    middleware.asyncHandler(controller.disconnectConnection)
  );

  router.get(
    '/:connectionId/accounts',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.view'),
    middleware.asyncHandler(controller.listAccounts)
  );

  router.get(
    '/:connectionId/health',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.view'),
    middleware.asyncHandler(controller.getHealth)
  );

  router.get(
    '/:connectionId/permissions',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.view'),
    middleware.asyncHandler(controller.listPermissions)
  );

  /* ---------------------------------------------------------------------------
   * Accounts
   * ------------------------------------------------------------------------ */
  router.get(
    '/accounts/:accountId/balances',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('connections.view'),
    middleware.validateParams(Joi.object({ accountId: UuidSchema.required() })),
    middleware.asyncHandler(controller.fetchBalances)
  );

  return router;
}

export default createConnectionsRoutes;