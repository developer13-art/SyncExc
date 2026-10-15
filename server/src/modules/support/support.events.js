/**
 * SyncExc Server — Support events
 */

export const SUPPORT_EMITS = [
  'support.ticket_created',
  'support.ticket_assigned',
  'support.ticket_escalated',
  'support.ticket_resolved',
  'support.ticket_reopened',
];

export const SUPPORT_CONSUMES = [];

export default {
  SUPPORT_EMITS,
  SUPPORT_CONSUMES,
};