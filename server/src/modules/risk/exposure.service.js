/**
 * SyncExc Server — Exposure service
 */

export function createExposureService({ db, queries, reservations, logger }) {
  /**
   * Calculate gross exposure for a workspace.
   */
  async function getWorkspaceExposure(workspaceId) {
    const result = await db.query(
      `
      SELECT 
        COALESCE(sum(ABS(quantity::numeric * COALESCE(mark_price, entry_price)::numeric)), 0)::text AS gross_exposure,
        COALESCE(sum(quantity::numeric * COALESCE(mark_price, entry_price)::numeric), 0)::text AS net_exposure
      FROM trading_positions
      WHERE workspace_id = $1 AND quantity > 0
      `,
      [workspaceId]
    );

    const row = result.rows[0] || { gross_exposure: '0', net_exposure: '0' };

    // Add active reservations (pending orders not yet filled)
    const reserved = await reservations.sumActiveReservationsByWorkspace(workspaceId);

    return {
      grossExposure: String(Number(row.gross_exposure) + Number(reserved)),
      netExposure: row.net_exposure,
      reservedValue: reserved,
    };
  }

  async function getAccountExposure({ workspaceId, accountId }) {
    const result = await db.query(
      `
      SELECT 
        COALESCE(sum(ABS(quantity::numeric * COALESCE(mark_price, entry_price)::numeric)), 0)::text AS gross_exposure
      FROM trading_positions
      WHERE workspace_id = $1 AND account_id = $2 AND quantity > 0
      `,
      [workspaceId, accountId]
    );
    return {
      grossExposure: result.rows[0]?.gross_exposure || '0',
    };
  }

  async function snapshotExposure({ workspaceId, scopeType, scopeId }) {
    const exposure =
      scopeType === 'workspace'
        ? await getWorkspaceExposure(workspaceId)
        : await getAccountExposure({ workspaceId, accountId: scopeId });

    return db.tx(async (tx) => {
      const snapshot = await queries.insertExposureSnapshot(tx, {
        workspaceId,
        scopeType,
        scopeId,
        grossExposure: exposure.grossExposure,
        netExposure: exposure.netExposure || '0',
      });
      return snapshot;
    });
  }

  return {
    getWorkspaceExposure,
    getAccountExposure,
    snapshotExposure,
  };
}

export default createExposureService;