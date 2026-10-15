/**
 * SyncExc Server — Auth test helpers
 */

import { createTestUser, createTestSession } from './factory.helper.js';

export async function createAuthenticatedUser(db, overrides = {}) {
  const user = await createTestUser(db, overrides);
  const session = await createTestSession(db, user.id);
  return { user, session, token: session.plaintextToken };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

export function cookieHeader(sessionToken, cookieName = 'syncexc_session') {
  return { Cookie: `${cookieName}=${sessionToken}` };
}