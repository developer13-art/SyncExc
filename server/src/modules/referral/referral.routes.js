/**
 * SyncExc Server — Referral routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { UuidSchema, PaginationSchema } from '@syncexc/shared';
import { createReferralController } from './referral.controller.js';

const EnrollSchema = Joi.object({
  acceptedAgreement: Joi.boolean().valid(true).required(),
  payoutCurrency: Joi.string().uppercase().length(3).default('USD'),
});

const CreateLinkSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  campaignLabel: Joi.string().trim().max(100).optional(),
  trackingParams: Joi.object().unknown(true).optional(),
});

const ClickSchema = Joi.object({
  code: Joi.string().trim().alphanum().min(6).max(32).uppercase().required(),
  referrer: Joi.string().uri().optional(),
});

const RequestPayoutSchema = Joi.object({
  methodId: UuidSchema.required(),
  amountMinor: Joi.number().integer().positive().required(),
  currency: Joi.string().uppercase().length(3).required(),
});

const CreatePolicySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  config: Joi.object({
    firstPayment: Joi.object({
      enabled: Joi.boolean().required(),
      rate: Joi.number().min(0).max(100).required(),
    }).optional(),
    recurring: Joi.object({
      enabled: Joi.boolean().required(),
      rate: Joi.number().min(0).max(100).required(),
      maxPayments: Joi.number().integer().min(1).optional(),
    }).optional(),
    minimumPaymentMinor: Joi.number().integer().min(0).default(0),
    holdingPeriodDays: Joi.number().integer().min(0).default(30),
  }).required(),
  effectiveFrom: Joi.date().iso().optional(),
});

const FraudDecisionSchema = Joi.object({
  decision: Joi.string().valid('cleared', 'confirmed_abuse', 'restricted', 'closed').required(),
  reason: Joi.string().min(10).max(500).required(),
});

export function createReferralRoutes(services) {
  const controller = createReferralController(services);
  const { middleware } = services;
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Public click tracking
   * ------------------------------------------------------------------------ */
  router.post(
    '/track/click',
    middleware.validateBody(ClickSchema),
    middleware.asyncHandler(controller.recordClick)
  );

  /* ---------------------------------------------------------------------------
   * Affiliate self-service
   * ------------------------------------------------------------------------ */
  router.get(
    '/affiliate/profile',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getProfile)
  );

  router.post(
    '/affiliate/enrollment',
    middleware.requireAuth(),
    middleware.validateBody(EnrollSchema),
    middleware.asyncHandler(controller.enroll)
  );

  router.get(
    '/affiliate/dashboard',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getDashboard)
  );

  /* Links */
  router.get(
    '/affiliate/referral-links',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listLinks)
  );

  router.post(
    '/affiliate/referral-links',
    middleware.requireAuth(),
    middleware.validateBody(CreateLinkSchema),
    middleware.asyncHandler(controller.createLink)
  );

  router.post(
    '/affiliate/referral-links/:linkId/pause',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.pauseLink)
  );

  router.post(
    '/affiliate/referral-links/:linkId/resume',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.resumeLink)
  );

  router.post(
    '/affiliate/referral-links/:linkId/revoke',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.revokeLink)
  );

  /* Commissions */
  router.get(
    '/affiliate/commissions',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listCommissions)
  );

  router.get(
    '/affiliate/ledger',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listLedger)
  );

  /* Payouts */
  router.get(
    '/affiliate/payout-methods',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listPayoutMethods)
  );

  router.get(
    '/affiliate/payouts',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listPayouts)
  );

  router.post(
    '/affiliate/payouts',
    middleware.requireAuth(),
    middleware.validateBody(RequestPayoutSchema),
    middleware.asyncHandler(controller.requestPayout)
  );

  router.get(
    '/affiliate/payouts/:payoutId',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getPayout)
  );

  /* ---------------------------------------------------------------------------
   * Admin - policies & fraud
   * ------------------------------------------------------------------------ */
  router.get(
    '/admin/policies',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listPolicies)
  );

  router.post(
    '/admin/policies',
    middleware.requireAuth(),
    middleware.validateBody(CreatePolicySchema),
    middleware.asyncHandler(controller.createPolicy)
  );

  router.post(
    '/admin/policies/:policyId/publish',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.publishPolicy)
  );

  router.get(
    '/admin/fraud-cases',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listFraudCases)
  );

  router.post(
    '/admin/fraud-cases/:caseId/decide',
    middleware.requireAuth(),
    middleware.validateBody(FraudDecisionSchema),
    middleware.asyncHandler(controller.decideFraudCase)
  );

  return router;
}

export default createReferralRoutes;