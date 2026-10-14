/**
 * SyncExc Server — Connections events
 */

export const CONNECTIONS_EMITS = [
  'connection.created',
  'connection.validated',
  'connection.activated',
  'connection.degraded',
  'connection.reauth_required',
  'connection.suspended',
  'connection.disconnected',
  'connection.credential_rotated',
];

export const CONNECTIONS_CONSUMES = [];

export function registerConnectionsEventHandlers({ events, service, logger }) {
  logger.debug(
    { emits: CONNECTIONS_EMITS.length, consumes: CONNECTIONS_CONSUMES.length },
    'Connections event handlers registered'
  );
}

export default registerConnectionsEventHandlers;