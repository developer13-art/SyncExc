/**
 * SyncExc Server — Billing routes
 */

import { Router } from 'express';
import Joi from 'joi';
import {
  CreateCheckoutRequestSchema,
  CancelSubscriptionRequestSchema,
  SubmitRefundRequestSchema,
  PaginationSchema,
  UuidSchema,
} from '@syncexc/shared';
import { createBillingController } from './billing.controller.js';

export function createBillingRoutes({ service, middleware }) {
  const controller = createBillingController({ service });
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Public plan catalog
   * ------------------------------------------------------------------------ */
  router.get(
    '/plans',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.listPlans)
  );

  router.get(
    '/plans/:planId',
    middleware.optionalAuth(),
    middleware.asyncHandler(controller.getPlan)
  );

  /* ---------------------------------------------------------------------------
   * Authenticated billing
   * ------------------------------------------------------------------------ */
  router.post(
    '/checkout',
    middleware.requireAuth(),
    middleware.validateBody(CreateCheckoutRequestSchema),
    middleware.asyncHandler(controller.createCheckout)
  );

  router.get(
    '/subscription',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getSubscription)
  );

  router.post(
    '/subscription/cancel',
    middleware.requireAuth(),
    middleware.validateBody(CancelSubscriptionRequestSchema),
    middleware.asyncHandler(controller.cancelSubscription)
  );

  router.get(
    '/payments',
    middleware.requireAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listPayments)
  );

  router.get(
    '/invoices',
    middleware.requireAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listInvoices)
  );

  router.get(
    '/invoices/:invoiceId',
    middleware.requireAuth(),
    middleware.validateParams(Joi.object({ invoiceId: UuidSchema.required() })),
    middleware.asyncHandler(controller.getInvoice)
  );

  router.post(
    '/refund-requests',
    middleware.requireAuth(),
    middleware.validateBody(SubmitRefundRequestSchema),
    middleware.asyncHandler(controller.requestRefund)
  );

  router.get(
    '/refund-requests',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listRefunds)
  );

  /* ---------------------------------------------------------------------------
   * Provider webhooks
   * ------------------------------------------------------------------------ */
  router.post(
    '/webhooks/:provider',
    middleware.asyncHandler(controller.handleWebhook)
  );

  return router;
}

export default createBillingRoutes;