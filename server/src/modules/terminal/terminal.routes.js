/**
 * SyncExc Server — Terminal routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  SubmitOrderRequestSchema,
  PaginationSchema,
  UuidSchema,
} from '@syncexc/shared';
import { createTerminalController } from './terminal.controller.js';

const OrdersQuerySchema = PaginationSchema.keys({
  status: Joi.string().max(64).optional(),
  accountId: UuidSchema.optional(),
});

const MarketDataParamsSchema = Joi.object({
  exchangeCode: Joi.string().valid('binance', 'bybit', 'bitget', 'okx').required(),
  symbol: Joi.string().pattern(/^[A-Za-z0-9._-]{3,48}$/).required(),
});

const MarketDataQuerySchema = Joi.object({
  marketType: Joi.string().valid('spot', 'futures', 'perpetual').default('spot'),
  timeframe: Joi.string().valid('1m', '5m', '15m', '1h', '4h', '1d').default('1h'),
  limit: Joi.number().integer().min(25).max(300).default(120),
});

export function createTerminalRoutes({ service, orderSubmissionService, portfolioService, middleware }) {
  const controller = createTerminalController({ service, orderSubmissionService, portfolioService });
  const router = Router();

  router.get(
    '/markets/:exchangeCode/:symbol/data',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.monitor'),
    middleware.validateParams(MarketDataParamsSchema),
    middleware.validateQuery(MarketDataQuerySchema),
    middleware.asyncHandler(controller.getMarketData)
  );

  /* ---------------------------------------------------------------------------
   * Overview
   * ------------------------------------------------------------------------ */
  router.get(
    '/overview',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.monitor'),
    middleware.asyncHandler(controller.overview)
  );

  /* ---------------------------------------------------------------------------
   * Orders
   * ------------------------------------------------------------------------ */
  router.get(
    '/orders',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.monitor'),
    middleware.validateQuery(OrdersQuerySchema),
    middleware.asyncHandler(controller.listOrders)
  );

  router.get(
    '/orders/open',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.monitor'),
    middleware.asyncHandler(controller.listOpenOrders)
  );

  router.post(
    '/orders',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.request_execution'),
    middleware.validateBody(SubmitOrderRequestSchema),
    middleware.asyncHandler(controller.submitOrder)
  );

  router.get(
    '/orders/:orderId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.monitor'),
    middleware.validateParams(Joi.object({ orderId: UuidSchema.required() })),
    middleware.asyncHandler(controller.getOrder)
  );

  router.post(
    '/executions/:executionRequestId/confirm',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.approve_execution'),
    middleware.validateParams(Joi.object({ executionRequestId: UuidSchema.required() })),
    middleware.asyncHandler(controller.confirmOrder)
  );

  router.post(
    '/executions/:executionRequestId/cancel-confirmation',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.request_execution'),
    middleware.validateParams(Joi.object({ executionRequestId: UuidSchema.required() })),
    middleware.asyncHandler(controller.cancelConfirmation)
  );

  router.get(
    '/executions/:executionRequestId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.monitor'),
    middleware.asyncHandler(controller.getExecutionRequest)
  );

  /* ---------------------------------------------------------------------------
   * Positions & trades
   * ------------------------------------------------------------------------ */
  router.get(
    '/positions',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.monitor'),
    middleware.asyncHandler(controller.listPositions)
  );

  router.get(
    '/trades',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requirePermission('trading.monitor'),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listTrades)
  );

  /* ---------------------------------------------------------------------------
   * Preferences
   * ------------------------------------------------------------------------ */
  router.get(
    '/preferences',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getPreferences)
  );

  router.patch(
    '/preferences',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.updatePreferences)
  );

  /* ---------------------------------------------------------------------------
   * Saved views
   * ------------------------------------------------------------------------ */
  router.get(
    '/saved-views',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listSavedViews)
  );

  router.post(
    '/saved-views',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.createSavedView)
  );

  router.delete(
    '/saved-views/:viewId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.deleteSavedView)
  );

  return router;
}

export default createTerminalRoutes;