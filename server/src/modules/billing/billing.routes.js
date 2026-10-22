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
  router.get(
    '/providers',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listPaymentProviders)
  );

  router.post(
    '/checkout',
    middleware.requireAuth(),
    middleware.validateBody(CreateCheckoutRequestSchema),
    middleware.asyncHandler(controller.createCheckout)
  );

  router.get(
    '/checkout/:checkoutId',
    middleware.requireAuth(),
    middleware.validateParams(Joi.object({ checkoutId: UuidSchema.required() })),
    middleware.asyncHandler(controller.getCheckoutStatus)
  );

  router.get(
    '/subscription',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getSubscription)
  );

  router.get(
    '/entitlements',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getEntitlements)
  );

  router.get(
    '/usage',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getUsage)
  );

  router.post(
    '/subscription/cancel',
    middleware.requireAuth(),
    middleware.validateBody(CancelSubscriptionRequestSchema),
    middleware.asyncHandler(controller.cancelSubscription)
  );

  router.post(
    '/subscription/reactivate',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.reactivateSubscription)
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