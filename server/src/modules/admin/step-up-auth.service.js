/**
 * SyncExc Server — Step-up auth service
 *
 * Sensitive admin operations require fresh authentication. This service
 * tracks and verifies step-up status per session.
 */

import { AuthenticationError } from '../../lib/errors.js';

const STEP_UP_TTL_MS = 15 * 60 * 1000;

export function createStepUpAuthService({ db, queries, logger }) {
  /**
   * Mark a session as having completed step-up authentication.
   */
  async function markStepUp({ sessionId, method = 'password' }) {
    await db.query(
      `
      UPDATE user_sessions
      SET step_up_at = now()
      WHERE id = $1
      `,
      [sessionId]
    );
    return { ok: true, method };
  }

  /**
   * Check whether a session has recent step-up.
   */
  async function verifyFresh({ sessionId }) {
    const result = await db.query(
      `SELECT step_up_at FROM user_sessions WHERE id = $1`,
      [sessionId]
    );
    if (result.rows.length === 0) return false;
    const stepUpAt = result.rows[0].step_up_at;
    if (!stepUpAt) return false;
    return Date.now() - new Date(stepUpAt).getTime() < STEP_UP_TTL_MS;
  }

  async function requireFresh({ sessionId }) {
    const fresh = await verifyFresh({ sessionId });
    if (!fresh) {
      throw new AuthenticationError(
        'This action requires recent verification. Please re-authenticate.',
        'STEP_UP_REQUIRED'
      );
    }
  }

  return {
    markStepUp,
    verifyFresh,
    requireFresh,
  };
}

export default createStepUpAuthService;