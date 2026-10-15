/**
 * SyncExc Server — Marketplace events
 */

export const MARKETPLACE_EMITS = [
  'marketplace.provider_created',
  'marketplace.provider_suspended',
  'marketplace.signal_published',
  'marketplace.signal_updated',
  'marketplace.signal_cancelled',
  'marketplace.follow_created',
  'marketplace.subscription_started',
  'marketplace.copy_config_created',
  'marketplace.copy_config_activated',
  'marketplace.copy_config_revoked',
  'marketplace.copy_signal_processed',
  'marketplace.moderation_action',
];

export const MARKETPLACE_CONSUMES = [];

export default {
  MARKETPLACE_EMITS,
  MARKETPLACE_CONSUMES,
};