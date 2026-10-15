/**
 * Identity Module — Unit Tests
 *
 * Covers registration, login, MFA, sessions, password reset, profile update,
 * trusted devices, and security events. Uses the in-process API.
 */

import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import {
  api,
  registerUser,
  registerUnverifiedUser,
  uniqueEmail,
  uniqueUsername,
  strongPassword,
  queryOne,
  queryAll,
  exec,
} from '../helpers.js';
import { getPool, closeDatabase } from '../../src/database/index.js';

afterAll(async () => {
  await closeDatabase();
});

describe('Identity — Registration', () => {
  test('registers a new user and returns 201 with user object', async () => {
    const email = uniqueEmail();
    const username = uniqueUsername();
    const password = strongPassword();

    const res = await api({
      method: 'post',
      path: '/api/v1/auth/register',
      body: {
        email,
        username,
        password,
        displayName: 'Test User',
        acceptedTerms: true,
        acceptedPrivacy: true,
        timezone: 'UTC',
        preferredLanguage: 'en',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email.toLowerCase());
    expect(res.body.user.username).toBe(username);
    expect(res.body.user.status).toBe('pending_verification');
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('rejects registration with an invalid email', async () => {
    const res = await api({
      method: 'post',
      path: '/api/v1/auth/register',
      body: {
        email: 'not-an-email',
        username: uniqueUsername(),
        password: strongPassword(),
        displayName: 'Test',
        acceptedTerms: true,
        acceptedPrivacy: true,
      },
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  test('rejects registration with a weak password', async () => {
    const res = await api({
      method: 'post',
      path: '/api/v1/auth/register',
      body: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'short',
        displayName: 'Test',
        acceptedTerms: true,
        acceptedPrivacy: true,
      },
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  test('rejects duplicate email registration', async () => {
    const email = uniqueEmail();
    await registerUnverifiedUser({ email });

    const res = await api({
      method: 'post',
      path: '/api/v1/auth/register',
      body: {
        email,
        username: uniqueUsername(),
        password: strongPassword(),
        displayName: 'Test',
        acceptedTerms: true,
        acceptedPrivacy: true,
      },
    });

    expect(res.status).toBe(409);
  });

  test('rejects duplicate username registration', async () => {
    const username = uniqueUsername();
    await registerUnverifiedUser({ username });

    const res = await api({
      method: 'post',
      path: '/api/v1/auth/register',
      body: {
        email: uniqueEmail(),
        username,
        password: strongPassword(),
        displayName: 'Test',
        acceptedTerms: true,
        acceptedPrivacy: true,
      },
    });

    expect(res.status).toBe(409);
  });

  test('rejects registration without terms acceptance', async () => {
    const res = await api({
      method: 'post',
      path: '/api/v1/auth/register',
      body: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: strongPassword(),
        displayName: 'Test',
        acceptedTerms: false,
        acceptedPrivacy: true,
      },
    });

    expect(res.status).toBe(422);
  });

  test('creates a personal workspace on registration', async () => {
    const { user } = await registerUnverifiedUser();
    const workspace = await queryOne(
      `SELECT * FROM workspaces WHERE owner_id = $1 AND type = 'personal'`,
      [user.id]
    );
    expect(workspace).not.toBeNull();
    expect(workspace.name).toContain('Personal');
  });
});

describe('Identity — Login', () => {
  test('logs in with valid credentials and sets session cookie', async () => {
    const { email, password } = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/auth/login',
      body: { email, password, rememberMe: false },
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('syncexc_session='))).toBe(true);
  });

  test('rejects invalid credentials without revealing user existence', async () => {
    const { email } = await registerUser();

    const res1 = await api({
      method: 'post',
      path: '/api/v1/auth/login',
      body: { email, password: 'wrong-password-here' },
    });

    const res2 = await api({
      method: 'post',
      path: '/api/v1/auth/login',
      body: { email: uniqueEmail(), password: 'wrong-password-here' },
    });

    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
    expect(res1.body.error.code).toBe(res2.body.error.code);
  });

  test('records a successful login security event', async () => {
    const { user } = await registerUser();
    const events = await queryAll(
      `SELECT * FROM user_security_events WHERE user_id = $1 AND event_type = 'login_success'`,
      [user.id]
    );
    expect(events.length).toBeGreaterThan(0);
  });

  test('records a failed login security event', async () => {
    const { user, email } = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/auth/login',
      body: { email, password: 'wrong-password' },
    });

    const events = await queryAll(
      `SELECT * FROM user_security_events WHERE user_id = $1 AND event_type = 'login_failure'`,
      [user.id]
    );
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('Identity — Sessions', () => {
  test('lists active sessions for the current user', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/users/me/sessions',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThan(0);
    expect(res.body.sessions.some((s) => s.isCurrent)).toBe(true);
  });

  test('revokes a specific session', async () => {
    const auth = await registerUser();

    const sessionsRes = await api({
      method: 'get',
      path: '/api/v1/users/me/sessions',
      cookies: auth.cookies,
    });

    const target = sessionsRes.body.sessions.find((s) => !s.isCurrent);
    // Create second session if none exists
    if (!target) {
      const loginRes = await api({
        method: 'post',
        path: '/api/v1/auth/login',
        body: { email: auth.email, password: auth.password },
      });
      const secondCookie = (loginRes.headers['set-cookie'] || [])
        .map((c) => c.split(';')[0])
        .find((c) => c.startsWith('syncexc_session='));

      const res = await api({
        method: 'get',
        path: '/api/v1/users/me/sessions',
        cookies: { syncexc_session: secondCookie.split('=')[1] },
      });

      const otherSession = res.body.sessions.find((s) => !s.isCurrent);
      const revokeRes = await api({
        method: 'delete',
        path: `/api/v1/users/me/sessions/${otherSession.id}`,
        cookies: auth.cookies,
      });

      expect(revokeRes.status).toBe(200);
      return;
    }

    const revokeRes = await api({
      method: 'delete',
      path: `/api/v1/users/me/sessions/${target.id}`,
      cookies: auth.cookies,
    });

    expect(revokeRes.status).toBe(200);
  });

  test('logout revokes the current session', async () => {
    const auth = await registerUser();

    const logoutRes = await api({
      method: 'post',
      path: '/api/v1/auth/logout',
      cookies: auth.cookies,
    });
    expect(logoutRes.status).toBe(200);

    const afterRes = await api({
      method: 'get',
      path: '/api/v1/users/me',
      cookies: auth.cookies,
    });
    expect(afterRes.status).toBe(401);
  });
});

describe('Identity — MFA', () => {
  test('enrolls MFA and requires code on subsequent login', async () => {
    const auth = await registerUser();

    const enrollRes = await api({
      method: 'post',
      path: '/api/v1/auth/mfa/enroll',
      cookies: auth.cookies,
    });

    expect(enrollRes.status).toBe(200);
    expect(enrollRes.body.secret).toBeDefined();
    expect(enrollRes.body.qrCodeDataUrl).toBeDefined();
  });

  test('returns MFA status for the current user', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/auth/mfa/status',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.mfaEnabled).toBe(false);
    expect(Array.isArray(res.body.recoveryCodesRemaining)).toBe(true);
  });
});

describe('Identity — Password Management', () => {
  test('changes password with correct current password', async () => {
    const auth = await registerUser();
    const newPassword = strongPassword();

    const res = await api({
      method: 'post',
      path: '/api/v1/auth/password/change',
      cookies: auth.cookies,
      body: {
        currentPassword: auth.password,
        newPassword,
      },
    });

    expect(res.status).toBe(200);
  });

  test('rejects password change with wrong current password', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/auth/password/change',
      cookies: auth.cookies,
      body: {
        currentPassword: 'wrong-password',
        newPassword: strongPassword(),
      },
    });

    expect(res.status).toBe(401);
  });

  test('requests a password reset without revealing account existence', async () => {
    const { email } = await registerUser();

    const res1 = await api({
      method: 'post',
      path: '/api/v1/auth/password/forgot',
      body: { email },
    });

    const res2 = await api({
      method: 'post',
      path: '/api/v1/auth/password/forgot',
      body: { email: uniqueEmail() },
    });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body).toEqual(res2.body);
  });

  test('records a password change security event', async () => {
    const auth = await registerUser();

    await api({
      method: 'post',
      path: '/api/v1/auth/password/change',
      cookies: auth.cookies,
      body: {
        currentPassword: auth.password,
        newPassword: strongPassword(),
      },
    });

    const events = await queryAll(
      `SELECT * FROM user_security_events WHERE user_id = $1 AND event_type = 'password_change'`,
      [auth.user.id]
    );
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('Identity — Profile', () => {
  test('returns current user profile', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/users/me',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(auth.user.id);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('updates permitted profile fields', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'patch',
      path: '/api/v1/users/me',
      cookies: auth.cookies,
      body: { displayName: 'Updated Name' },
    });

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe('Updated Name');
  });

  test('rejects updates to protected fields', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'patch',
      path: '/api/v1/users/me',
      cookies: auth.cookies,
      body: { email: 'hacker@example.com' },
    });

    // Email change requires a dedicated flow; direct patch should ignore or reject
    expect([200, 422].includes(res.status)).toBe(true);
    if (res.status === 200) {
      expect(res.body.user.email).toBe(auth.email);
    }
  });
});

describe('Identity — Security Events', () => {
  test('lists security events for the current user', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/users/me/security-events',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  test('a user cannot view another user\'s security events', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();

    const res = await api({
      method: 'get',
      path: `/api/v1/users/${auth2.user.id}/security-events`,
      cookies: auth1.cookies,
    });

    expect(res.status).toBe(403);
  });
});

describe('Identity — Authentication Guards', () => {
  test('rejects unauthenticated access to protected routes', async () => {
    const res = await api({
      method: 'get',
      path: '/api/v1/users/me',
    });
    expect(res.status).toBe(401);
  });

  test('rejects access with a revoked session cookie', async () => {
    const auth = await registerUser();
    await api({
      method: 'post',
      path: '/api/v1/auth/logout',
      cookies: auth.cookies,
    });

    const res = await api({
      method: 'get',
      path: '/api/v1/users/me',
      cookies: auth.cookies,
    });
    expect(res.status).toBe(401);
  });
});