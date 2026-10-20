/**
 * SyncExc Server — Identity events
 *
 * Lists the events this module produces and the ones it consumes.
 * Consumed events are registered with the event bus at init.
 */

/**
 * Events emitted by the identity module.
 */
export const IDENTITY_EMITS = [
  'user.registered',
  'user.email_verified',
  'user.email_changed',
  'user.password_changed',
  'user.mfa_enabled',
  'user.mfa_disabled',
  'user.session_created',
  'user.session_revoked',
  'user.preferences_updated',
  'user.restricted',
  'user.restored',
];

/**
 * Events consumed by the identity module.
 * Empty for now — identity is a producer-only module.
 */
export const IDENTITY_CONSUMES = [];

/**
 * Register the identity module's event handlers.
 * Called during bootstrap.
 */
export function registerIdentityEventHandlers({ events, service, logger }) {
  // Identity currently consumes no events. If this changes (e.g. to
  // invalidate sessions when a password is reset from admin), register
  // handlers here.
  logger.debug({ emits: IDENTITY_EMITS.length, consumes: IDENTITY_CONSUMES.length }, 'Identity event handlers registered');
}

export default registerIdentityEventHandlers;