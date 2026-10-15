/**
 * SyncExc Server — Incidents events
 */

export const INCIDENTS_EMITS = [
  'platform.incident_created',
  'platform.incident_updated',
  'platform.incident_resolved',
];

export const INCIDENTS_CONSUMES = [];

export default {
  INCIDENTS_EMITS,
  INCIDENTS_CONSUMES,
};