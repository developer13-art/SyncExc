/**
 * SyncExc Server — JWT helpers
 *
 * Access tokens: short-lived, contain user + session + workspace claims.
 * Refresh tokens: long-lived, single-use, stored hashed in DB.
 *
 * Refresh tokens are NOT JWTs — they are opaque random strings whose hash
 * is stored in `sessions`. This gives us server-side revocation.
 */

import jwt from 'jsonwebtoken';
import config from '../config.js';
import { AuthenticationError } from './errors.js';

/**
 * Issue an access token.
 */
export function issueAccessToken({ userId, sessionId, workspaceId = null, extra = {} }) {
  return jwt.sign(
    {
      sub: userId,
      sid: sessionId,
      wid: workspaceId,
      ...extra,
    },
    config.jwt.accessSecret,
    {
      expiresIn: config.jwt.accessTtl,
      issuer: 'syncexc',
      audience: 'syncexc-api',
    }
  );
}

/**
 * Verify an access token. Returns the payload or throws AuthenticationError.
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret, {
      issuer: 'syncexc',
      audience: 'syncexc-api',
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthenticationError('Access token expired', 'TOKEN_EXPIRED');
    }
    throw new AuthenticationError('Invalid access token', 'TOKEN_INVALID');
  }
}

/**
 * Decode a token without verifying. Useful for logging subject IDs on
 * authentication failure. Never trust the result.
 */
export function decodeUnsafe(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

export const jwtLib = {
  issueAccessToken,
  verifyAccessToken,
  decodeUnsafe,
};

export default jwtLib;