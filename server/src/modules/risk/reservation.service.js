/**
 * SyncExc Server — Risk reservation service
 */

import { randomUUID } from 'node:crypto';

export function createReservationService({ db, queries, logger }) {
  /**
   * Reserve capacity for an in-flight operation. Reservations prevent
   * concurrent operations from each independently passing the same limit
   * check.
   */
  async function reserve({ workspaceId, scopeKey, reservationType, value, operationRef, expiresInMs }) {
    return db.tx(async (tx) => {
      const reservation = await queries.insertReservation(tx, {
        workspaceId,
        scopeKey,
        reservationType,
        reservedValue: value,
        operationRef,
        expiresAt: expiresInMs ? new Date(Date.now() + expiresInMs) : null,
      });
      return reservation;
    });
  }

  async function release(reservationId) {
    return queries.releaseReservation(reservationId, 'released');
  }

  async function consume(reservationId) {
    return queries.releaseReservation(reservationId, 'consumed');
  }

  async function sumActiveReservations(workspaceId, scopeKey, type) {
    return queries.sumActiveReservations(workspaceId, scopeKey, type);
  }

  async function sumActiveReservationsByWorkspace(workspaceId) {
    const result = await db.query(
      `
      SELECT COALESCE(sum(reserved_value), 0)::text AS total
      FROM risk_reservations
      WHERE workspace_id = $1 AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
      `,
      [workspaceId]
    );
    return result.rows[0]?.total || '0';
  }

  async function expireStaleReservations() {
    return queries.expireStaleReservations();
  }

  return {
    reserve,
    release,
    consume,
    sumActiveReservations,
    sumActiveReservationsByWorkspace,
    expireStaleReservations,
  };
}

export default createReservationService;