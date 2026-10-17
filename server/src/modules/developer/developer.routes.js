/**
 * SyncExc Server — Developer routes (management)
 */

import { Router } from 'express';
import Joi from 'joi';
import { UuidSchema, PaginationSchema } from '@syncexc/shared';
import { AuthorizationError } from '../../lib/errors.js';
import { createDeveloperController } from './developer.controller.js';

const CreateApplicationSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  type: Joi.string().valid('personal', 'organization', 'third_party').required(),
  redirectUris: Joi.array().items(Joi.string().uri({ scheme: ['https'] })).max(10).optional(),
  website: Joi.string().uri().optional(),
  privacyPolicyUrl: Joi.string().uri().optional(),
  supportContact: Joi.string().email().optional(),
});

const UpdateApplicationSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  state: Joi.string().valid('active', 'restricted', 'suspended', 'revoked').optional(),
  website: Joi.string().uri().optional(),
  privacyPolicyUrl: Joi.string().uri().optional(),
  supportContact: Joi.string().email().optional(),
}).min(1);

const CreateCredentialSchema = Joi.object({
  environment: Joi.string().valid('sandbox', 'production').required(),
  scopes: Joi.array().items(Joi.string()).min(1).required(),
  expiresInDays: Joi.number().integer().min(1).max(365).optional(),
});

const RevokeCredentialSchema = Joi.object({
  reason: Joi.string().min(10).max(500).required(),
});

const RegisterOauthClientSchema = Joi.object({
  redirectUris: Joi.array().items(Joi.string().uri({ scheme: ['https'] })).min(1).required(),
});

const CreateAuthCodeSchema = Joi.object({
  clientId: Joi.string().required(),
  redirectUri: Joi.string().uri().required(),
  scopes: Joi.array().items(Joi.string()).min(1).required(),
  codeChallenge: Joi.string().optional(),
  codeChallengeMethod: Joi.string().valid('S256', 'plain').optional(),
});

const ExchangeCodeSchema = Joi.object({
  clientId: Joi.string().required(),
  code: Joi.string().required(),
  redirectUri: Joi.string().uri().required(),
  codeVerifier: Joi.string().optional(),
});

const RefreshTokenSchema = Joi.object({
  clientId: Joi.string().required(),
  refreshToken: Joi.string().required(),
});

const ClientCredentialsSchema = Joi.object({
  clientId: Joi.string().required(),
  clientSecret: Joi.string().required(),
  scopes: Joi.array().items(Joi.string()).min(1).required(),
});

const CreateWebhookSchema = Joi.object({
  destinationUrl: Joi.string().uri({ scheme: ['https'] }).required(),
  eventTypes: Joi.array().items(Joi.string()).min(1).required(),
  resourceFilters: Joi.object().unknown(true).optional(),
});

const UpdateWebhookSchema = Joi.object({
  destinationUrl: Joi.string().uri({ scheme: ['https'] }).optional(),
  eventTypes: Joi.array().items(Joi.string()).min(1).optional(),
  resourceFilters: Joi.object().unknown(true).optional(),
  state: Joi.string().valid('active', 'paused', 'suspended').optional(),
}).min(1);

const SimulateWebhookSchema = Joi.object({
  sessionRef: Joi.string().required(),
  subscriptionId: UuidSchema.required(),
  eventType: Joi.string().required(),
});

export function createDeveloperRoutes(services) {
  const controller = createDeveloperController(services);
  const baseMiddleware = services.middleware;
  const middleware = Object.create(baseMiddleware);
  middleware.requireWorkspace = (options) => {
    const requireWorkspace = baseMiddleware.requireWorkspace(options);
    return (req, res, next) => requireWorkspace(req, res, (error) => {
      if (error) return next(error);
      if (req.workspace?.workspace?.type !== 'developer') {
        return next(new AuthorizationError(
          'Switch to a Developer workspace to manage applications and credentials',
          'DEVELOPER_WORKSPACE_REQUIRED',
        ));
      }
      return next();
    });
  };
  const router = Router();

  /* ---------------------------------------------------------------------------
   * Applications
   * ------------------------------------------------------------------------ */
  router.get(
    '/applications',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listApplications)
  );

  router.post(
    '/applications',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateApplicationSchema),
    middleware.asyncHandler(controller.createApplication)
  );

  router.get(
    '/applications/:applicationId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getApplication)
  );

  router.patch(
    '/applications/:applicationId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(UpdateApplicationSchema),
    middleware.asyncHandler(controller.updateApplication)
  );

  router.post(
    '/applications/:applicationId/suspend',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.suspendApplication)
  );

  /* ---------------------------------------------------------------------------
   * Credentials
   * ------------------------------------------------------------------------ */
  router.get(
    '/applications/:applicationId/credentials',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listCredentials)
  );

  router.post(
    '/applications/:applicationId/credentials',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requireStepUp(),
    middleware.validateBody(CreateCredentialSchema),
    middleware.asyncHandler(controller.createCredential)
  );

  router.post(
    '/credentials/:credentialId/revoke',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(RevokeCredentialSchema),
    middleware.asyncHandler(controller.revokeCredential)
  );

  router.post(
    '/credentials/:credentialId/rotate',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.rotateCredential)
  );

  /* ---------------------------------------------------------------------------
   * OAuth
   * ------------------------------------------------------------------------ */
  router.post(
    '/applications/:applicationId/oauth-clients',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(RegisterOauthClientSchema),
    middleware.asyncHandler(controller.registerOauthClient)
  );

  router.post(
    '/oauth/authorize',
    middleware.requireAuth(),
    middleware.validateBody(CreateAuthCodeSchema),
    middleware.asyncHandler(controller.createAuthorizationCode)
  );

  router.post(
    '/oauth/token/code',
    middleware.validateBody(ExchangeCodeSchema),
    middleware.asyncHandler(controller.exchangeAuthorizationCode)
  );

  router.post(
    '/oauth/token/refresh',
    middleware.validateBody(RefreshTokenSchema),
    middleware.asyncHandler(controller.exchangeRefreshToken)
  );

  router.post(
    '/oauth/token/client-credentials',
    middleware.validateBody(ClientCredentialsSchema),
    middleware.asyncHandler(controller.clientCredentials)
  );

  router.get(
    '/oauth/grants',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listOauthGrants)
  );

  router.post(
    '/oauth/grants/:grantId/revoke',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.revokeOauthGrant)
  );

  /* ---------------------------------------------------------------------------
   * Webhooks
   * ------------------------------------------------------------------------ */
  router.get(
    '/applications/:applicationId/webhooks',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listWebhooks)
  );

  router.post(
    '/applications/:applicationId/webhooks',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(CreateWebhookSchema),
    middleware.asyncHandler(controller.createWebhook)
  );

  router.get(
    '/webhooks/:subscriptionId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getWebhook)
  );

  router.patch(
    '/webhooks/:subscriptionId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(UpdateWebhookSchema),
    middleware.asyncHandler(controller.updateWebhook)
  );

  router.delete(
    '/webhooks/:subscriptionId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.deleteWebhook)
  );

  router.post(
    '/webhooks/:subscriptionId/rotate-secret',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.requireStepUp(),
    middleware.asyncHandler(controller.rotateWebhookSecret)
  );

  router.get(
    '/webhooks/:subscriptionId/deliveries',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.listDeliveries)
  );

  router.get(
    '/webhook-deliveries/:deliveryId',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getDelivery)
  );

  router.post(
    '/webhook-deliveries/:deliveryId/replay',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.replayDelivery)
  );

  /* ---------------------------------------------------------------------------
   * Usage
   * ------------------------------------------------------------------------ */
  router.get(
    '/applications/:applicationId/usage',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getUsageSummary)
  );

  router.get(
    '/applications/:applicationId/usage/endpoints',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getUsageByEndpoint)
  );

  /* ---------------------------------------------------------------------------
   * Sandbox
   * ------------------------------------------------------------------------ */
  router.post(
    '/applications/:applicationId/sandbox-sessions',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.createSandboxSession)
  );

  router.get(
    '/sandbox/sessions/:sessionRef/fixtures',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.asyncHandler(controller.getSandboxFixtures)
  );

  router.post(
    '/sandbox/simulate-webhook',
    middleware.requireAuth(),
    middleware.requireWorkspace(),
    middleware.validateBody(SimulateWebhookSchema),
    middleware.asyncHandler(controller.simulateWebhook)
  );

  return router;
}

export default createDeveloperRoutes;