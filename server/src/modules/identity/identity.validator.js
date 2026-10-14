/**
 * SyncExc Server — Identity validators
 *
 * Additional Joi schemas specific to Module 01 that are not part of the
 * shared validation surface.
 */

import Joi from 'joi';
import { UuidSchema } from '@syncexc/shared';

export const RevokeSessionParamsSchema = Joi.object({
  sessionId: UuidSchema.required(),
});

export const RevokeDeviceParamsSchema = Joi.object({
  deviceId: UuidSchema.required(),
});

export const EmailVerificationTokenSchema = Joi.object({
  token: Joi.string().min(32).max(256).required(),
});

export const EmailSchema = Joi.string().email({ tlds: { allow: false } }).required();

export const LoginRateLimitSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const UpdateNotificationPreferencesSchema = Joi.object({
  preferences: Joi.array()
    .items(
      Joi.object({
        notificationType: Joi.string().required(),
        channel: Joi.string().valid('in_app', 'email', 'push').required(),
        enabled: Joi.boolean().required(),
      })
    )
    .required(),
});

export default {
  RevokeSessionParamsSchema,
  RevokeDeviceParamsSchema,
  EmailVerificationTokenSchema,
  EmailSchema,
  LoginRateLimitSchema,
  UpdateNotificationPreferencesSchema,
};