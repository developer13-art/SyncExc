/**
 * SyncExc Server — Identity routes
 *
 * All HTTP endpoints for Module 01. Mounted at `/api/v1/auth`, `/api/v1/users`,
 * and `/api/v1/security` by `mountRoutes`.
 */

import { Router } from 'express';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  MfaVerifyRequestSchema,
  MfaEnrollConfirmSchema,
  PasswordChangeRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  EmailChangeRequestSchema,
  ProfileUpdateSchema,
  PaginationSchema,
  UuidSchema,
} from '@syncexc/shared';
import Joi from 'joi';
import { createIdentityController } from './identity.controller.js';

const UserPreferencesSchema = Joi.object({
  general: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'system'),
  }).min(1),
  trading: Joi.object({
    defaultMarketType: Joi.string().valid('spot', 'futures'),
    defaultOrderType: Joi.string().valid('limit', 'market'),
    defaultChartTimeframe: Joi.string().valid('1m', '5m', '15m', '1h', '4h', '1d'),
  }).min(1),
}).min(1);

export function createIdentityRoutes({ service, middleware }) {
  const controller = createIdentityController({ service });

  const authRouter = Router();
  const usersRouter = Router();
  const securityRouter = Router();

  /* ===========================================================================
   * AUTH — public and semi-public
   * ======================================================================== */

  authRouter.post(
    '/register',
    middleware.authLimiter,
    middleware.validateBody(RegisterRequestSchema),
    middleware.asyncHandler(controller.register)
  );

  authRouter.post(
    '/login',
    middleware.authLimiter,
    middleware.validateBody(LoginRequestSchema),
    middleware.asyncHandler(controller.login)
  );

  authRouter.post(
    '/mfa/verify',
    middleware.authLimiter,
    middleware.validateBody(MfaVerifyRequestSchema),
    middleware.asyncHandler(controller.verifyMfa)
  );

  authRouter.post(
    '/logout',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.logout)
  );

  authRouter.post(
    '/logout-all',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.logoutAll)
  );

  authRouter.post(
    '/verify-email',
    middleware.validateBody(Joi.object({ token: Joi.string().min(32).max(256).required() })),
    middleware.asyncHandler(controller.verifyEmail)
  );

  authRouter.post(
    '/verification/resend',
    middleware.authLimiter,
    middleware.validateBody(Joi.object({ email: Joi.string().email().required() })),
    middleware.asyncHandler(controller.resendVerification)
  );

  authRouter.post(
    '/password/forgot',
    middleware.authLimiter,
    middleware.validateBody(PasswordResetRequestSchema),
    middleware.asyncHandler(controller.requestPasswordReset)
  );

  authRouter.post(
    '/password/reset',
    middleware.authLimiter,
    middleware.validateBody(PasswordResetConfirmSchema),
    middleware.asyncHandler(controller.resetPassword)
  );

  /* ===========================================================================
   * AUTH — authenticated
   * ======================================================================== */

  authRouter.post(
    '/password/change',
    middleware.requireAuth(),
    middleware.validateBody(PasswordChangeRequestSchema),
    middleware.asyncHandler(controller.changePassword)
  );

  /* ===========================================================================
   * MFA
   * ======================================================================== */

  authRouter.get(
    '/mfa/status',
    middleware.requireAuth(),
    middleware.asyncHandler(async (req, res) => {
      const user = await service.getUserById(req.auth.userId);
      res.json({ data: { mfaEnabled: Boolean(user?.mfa_enabled_at) } });
    })
  );

  authRouter.post(
    '/mfa/enroll',
    middleware.requireAuth(),
    middleware.requireStepUp(),
    middleware.asyncHandler(controller.mfaBeginEnrollment)
  );

  authRouter.post(
    '/mfa/confirm',
    middleware.requireAuth(),
    middleware.validateBody(MfaEnrollConfirmSchema),
    middleware.asyncHandler(controller.mfaConfirmEnrollment)
  );

  authRouter.post(
    '/mfa/disable',
    middleware.requireAuth(),
    middleware.requireStepUp(),
    middleware.asyncHandler(controller.mfaDisable)
  );

  authRouter.post(
    '/mfa/recovery-codes/regenerate',
    middleware.requireAuth(),
    middleware.requireStepUp(),
    middleware.asyncHandler(controller.mfaRegenerateRecoveryCodes)
  );

  /* ===========================================================================
   * USERS — own profile
   * ======================================================================== */

  usersRouter.get(
    '/me',
    middleware.requireAuth(),
    middleware.loadUserIfAuthenticated(),
    middleware.asyncHandler(controller.getMe)
  );

  usersRouter.patch(
    '/me',
    middleware.requireAuth(),
    middleware.validateBody(ProfileUpdateSchema),
    middleware.asyncHandler(controller.updateProfile)
  );

  usersRouter.get(
    '/me/preferences',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.getUserPreferences)
  );

  usersRouter.patch(
    '/me/preferences',
    middleware.requireAuth(),
    middleware.validateBody(UserPreferencesSchema),
    middleware.asyncHandler(controller.updateUserPreferences)
  );

  usersRouter.post(
    '/me/email-change',
    middleware.requireAuth(),
    middleware.requireStepUp(),
    middleware.validateBody(EmailChangeRequestSchema),
    middleware.asyncHandler(controller.requestEmailChange)
  );

  usersRouter.post(
    '/me/email-change/confirm',
    middleware.validateBody(Joi.object({ token: Joi.string().min(32).max(256).required() })),
    middleware.asyncHandler(controller.confirmEmailChange)
  );

  /* ===========================================================================
   * SESSIONS
   * ======================================================================== */

  usersRouter.get(
    '/me/sessions',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listSessions)
  );

  usersRouter.delete(
    '/me/sessions/:sessionId',
    middleware.requireAuth(),
    middleware.validateParams(Joi.object({ sessionId: UuidSchema.required() })),
    middleware.asyncHandler(controller.revokeSession)
  );

  /* ===========================================================================
   * TRUSTED DEVICES
   * ======================================================================== */

  usersRouter.get(
    '/me/trusted-devices',
    middleware.requireAuth(),
    middleware.asyncHandler(controller.listTrustedDevices)
  );

  usersRouter.delete(
    '/me/trusted-devices/:deviceId',
    middleware.requireAuth(),
    middleware.validateParams(Joi.object({ deviceId: UuidSchema.required() })),
    middleware.asyncHandler(controller.revokeTrustedDevice)
  );

  /* ===========================================================================
   * SECURITY EVENTS
   * ======================================================================== */

  usersRouter.get(
    '/me/security-events',
    middleware.requireAuth(),
    middleware.validateQuery(PaginationSchema),
    middleware.asyncHandler(controller.listSecurityEvents)
  );

  return {
    auth: authRouter,
    users: usersRouter,
    security: securityRouter,
  };
}

export default createIdentityRoutes;