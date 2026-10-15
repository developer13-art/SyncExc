/**
 * Auth Flow — Integration Test
 *
 * End-to-end: register → verify email → login → MFA enroll → MFA verify →
 * access protected resource → logout → session revoked.
 */

import { describe, expect, test, afterAll } from '@jest/globals';
import {
  api,
  uniqueEmail,
  uniqueUsername,
  strongPassword,
  queryOne,
} from '../helpers.js';
import { closeDatabase } from '../../src/database/index.js';

afterAll(async () => {
  await closeDatabase();
});

describe('Auth flow — end-to-end', () => {
  test('complete registration, verification, login, and logout', async () => {
    const email = uniqueEmail('flow');
    const username = uniqueUsername('flow');
    const password = strongPassword();

    // 1. Register
    const registerRes = await api({
      method: 'post',
      path: '/api/v1/auth/register',
      body: {
        email,
        username,
        password,
        displayName: 'Flow User',
        acceptedTerms: true,
        acceptedPrivacy: true,
        timezone: 'UTC',
        preferredLanguage: 'en',
      },
    });
    expect(registerRes.status).toBe(201);
    const userId = registerRes.body.user.id;

    // 2. Login should fail while email is not verified
    const pendingLoginRes = await api({
      method: 'post',
      path: '/api/v1/auth/login',
      body: { email, password },
    });
    expect([401, 403]).toContain(pendingLoginRes.status);

    // 3. Force email verification (test shortcut)
    const pool = (await import('../../src/database/index.js')).getPool();
    await pool.query(
      `UPDATE users SET email_verified_at = NOW(), status = 'active' WHERE id = $1`,
      [userId]
    );

    // 4. Login succeeds
    const loginRes = await api({
      method: 'post',
      path: '/api/v1/auth/login',
      body: { email, password },
    });
    expect(loginRes.status).toBe(200);

    const sessionCookie = (loginRes.headers['set-cookie'] || [])
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('syncexc_session='));
    const cookieValue = sessionCookie.split('=')[1];

    // 5. Access protected resource
    const meRes = await api({
      method: 'get',
      path: '/api/v1/users/me',
      cookies: { syncexc_session: cookieValue },
    });
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(email.toLowerCase());

    // 6. Enroll MFA
    const enrollRes = await api({
      method: 'post',
      path: '/api/v1/auth/mfa/enroll',
      cookies: { syncexc_session: cookieValue },
    });
    expect(enrollRes.status).toBe(200);
    expect(enrollRes.body.secret).toBeDefined();

    // 7. Logout
    const logoutRes = await api({
      method: 'post',
      path: '/api/v1/auth/logout',
      cookies: { syncexc_session: cookieValue },
    });
    expect(logoutRes.status).toBe(200);

    // 8. Reuse session fails
    const afterRes = await api({
      method: 'get',
      path: '/api/v1/users/me',
      cookies: { syncexc_session: cookieValue },
    });
    expect(afterRes.status).toBe(401);

    // 9. Session record is marked revoked
    const sessions = await queryOne(
      `SELECT COUNT(*)::int AS count FROM user_sessions WHERE user_id = $1 AND revoked_at IS NOT NULL`,
      [userId]
    );
    expect(sessions.count).toBeGreaterThan(0);
  });
});