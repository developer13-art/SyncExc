/**
 * SyncExc Server — Signals events
 */

export const SIGNALS_EMITS = [
  'signal.message_received',
  'signal.candidate_created',
  'signal.validated',
  'signal.eligible',
  'signal.blocked',
  'signal.review_required',
  'signal.intent_created',
  'signal.intent_canceled',
];

export const SIGNALS_CONSUMES = [
  'source.activated',
  'source.paused',
  'source.health_changed',
];

export default {
  SIGNALS_EMITS,
  SIGNALS_CONSUMES,
};