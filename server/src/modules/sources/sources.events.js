/**
 * SyncExc Server — Sources events
 */

export const SOURCES_EMITS = [
  'source.registered',
  'source.approved',
  'source.rejected',
  'source.activated',
  'source.paused',
  'source.archived',
  'source.connected',
  'source.disconnected',
  'source.health_changed',
  'source.validation_completed',
  'source.discovery_completed',
];

export const SOURCES_CONSUMES = [
  'signal.message_received',
];

export default {
  SOURCES_EMITS,
  SOURCES_CONSUMES,
};