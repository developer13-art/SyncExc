/**
 * SyncExc Server — WebSocket session resolution
 *
 * Reuses the same session token format as the HTTP API. Accepts:
 *   1. Opaque session token (session cookie value).
 *   2. JWT access token.
 *
 * The resolution returns { userId, sessionId, workspaceIds } or null.
 * Workspace IDs are the list of active workspace memberships for the user,
 * used to authorize `workspace:<id>` channels.
 */

import { createHash } from 'node:crypto';
import config from '../config.js';
import { verifyAccessToken } from '../lib/jwt.js';

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function resolveSessionFromToken(token, { logger, db }) {
  if (!token || typeof token !== 'string') return null;

  // ---------------------------------------------------------------------------
  // 1. Try the opaque session token against the database
  // ---------------------------------------------------------------------------
  const database = db;

  if (database) {
    const tokenHash = hashSessionToken(token);
    const result = await database.query(
      `
      SELECT id, user_id, expires_at, revoked_at, step_up_at
      FROM user_sessions
      WHERE session_token_hash = $1
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rows.length > 0) {
      const session = result.rows[0];
      if (session.revoked_at) return null;
      if (new Date(session.expires_at) <= new Date()) return null;

      const workspaces = await loadWorkspacesForUser(database, session.user_id);

      return {
        userId: session.user_id,
        sessionId: session.id,
        workspaceIds: workspaces,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Try to interpret the token as a JWT
  // ---------------------------------------------------------------------------
  try {
    const payload = verifyAccessToken(token);
    if (payload && payload.sub) {
      const workspaces = database
        ? await loadWorkspacesForUser(database, payload.sub)
        : [];
      return {
        userId: payload.sub,
        sessionId: payload.sid || null,
        workspaceIds: workspaces,
      };
    }
  } catch {
    // fall through
  }

  logger.debug('WebSocket authentication failed: token not recognized');
  return null;
}

async function loadWorkspacesForUser(db, userId) {
  const result = await db.query(
    `
    SELECT workspace_id
    FROM workspace_memberships
    WHERE user_id = $1
      AND status = 'active'
    `,
    [userId]
  );
  return result.rows.map((r) => r.workspace_id);
}

export default resolveSessionFromToken;
export { hashSessionToken };