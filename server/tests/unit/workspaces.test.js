/**
 * Workspaces Module — Unit Tests
 *
 * Covers workspace creation, member management, invitations, roles,
 * connection sharing, ownership transfer, and cross-workspace isolation.
 */

import { describe, expect, test, afterAll } from '@jest/globals';
import {
  api,
  registerUser,
  createWorkspace,
  queryOne,
  queryAll,
  uniqueEmail,
} from '../helpers.js';
import { closeDatabase } from '../../src/database/index.js';

afterAll(async () => {
  await closeDatabase();
});

describe('Workspaces — Creation', () => {
  test('creates a personal workspace automatically on registration', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'get',
      path: '/api/v1/workspaces',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    const personal = res.body.workspaces.find((w) => w.type === 'personal');
    expect(personal).toBeDefined();
    expect(personal.ownerId).toBe(auth.user.id);
  });

  test('creates an organization workspace', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/workspaces',
      cookies: auth.cookies,
      body: {
        name: 'Acme Trading',
        type: 'organization',
        description: 'Our trading team',
        timezone: 'UTC',
        preferredLanguage: 'en',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.workspace.name).toBe('Acme Trading');
    expect(res.body.workspace.type).toBe('organization');
    expect(res.body.workspace.ownerId).toBe(auth.user.id);
  });

  test('rejects workspace creation with an empty name', async () => {
    const auth = await registerUser();

    const res = await api({
      method: 'post',
      path: '/api/v1/workspaces',
      cookies: auth.cookies,
      body: {
        name: '',
        type: 'organization',
      },
    });

    expect(res.status).toBe(422);
  });

  test('lists only workspaces the user belongs to', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();

    await createWorkspace(auth1, { name: 'Workspace A' });
    await createWorkspace(auth2, { name: 'Workspace B' });

    const res = await api({
      method: 'get',
      path: '/api/v1/workspaces',
      cookies: auth1.cookies,
    });

    expect(res.status).toBe(200);
    const names = res.body.workspaces.map((w) => w.name);
    expect(names).toContain('Workspace A');
    expect(names).not.toContain('Workspace B');
  });
});

describe('Workspaces — Members and Invitations', () => {
  test('owner invites a member by email', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);
    const inviteeEmail = uniqueEmail('invitee');

    const res = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/invitations`,
      cookies: owner.cookies,
      body: {
        email: inviteeEmail,
        role: 'analyst',
        expiresInDays: 7,
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.invitation.email).toBe(inviteeEmail.toLowerCase());
    expect(res.body.invitation.role).toBe('analyst');
    expect(res.body.invitation.status).toBe('pending');
  });

  test('accepts a valid invitation', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);
    const invitee = await registerUser();

    const inviteRes = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/invitations`,
      cookies: owner.cookies,
      body: {
        email: invitee.email,
        role: 'analyst',
        expiresInDays: 7,
      },
    });

    const token = inviteRes.body.invitation.token;
    expect(token).toBeDefined();

    const acceptRes = await api({
      method: 'post',
      path: `/api/v1/invitations/${token}/accept`,
      cookies: invitee.cookies,
    });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.membership.role).toBe('analyst');
  });

  test('rejects an expired invitation', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);
    const invitee = await registerUser();

    const inviteRes = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/invitations`,
      cookies: owner.cookies,
      body: { email: invitee.email, role: 'analyst', expiresInDays: 1 },
    });

    const token = inviteRes.body.invitation.token;

    // Force expiration
    await queryOne(
      `UPDATE workspace_invitations SET expires_at = NOW() - INTERVAL '1 hour' WHERE token_hash IS NOT NULL AND workspace_id = $1 RETURNING id`,
      [workspace.id]
    );

    const acceptRes = await api({
      method: 'post',
      path: `/api/v1/invitations/${token}/accept`,
      cookies: invitee.cookies,
    });

    expect(acceptRes.status).toBe(410);
  });

  test('rejects an invitation token that was already used', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);
    const invitee = await registerUser();

    const inviteRes = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/invitations`,
      cookies: owner.cookies,
      body: { email: invitee.email, role: 'analyst', expiresInDays: 7 },
    });

    const token = inviteRes.body.invitation.token;

    await api({
      method: 'post',
      path: `/api/v1/invitations/${token}/accept`,
      cookies: invitee.cookies,
    });

    const secondAccept = await api({
      method: 'post',
      path: `/api/v1/invitations/${token}/accept`,
      cookies: invitee.cookies,
    });

    expect(secondAccept.status).toBe(410);
  });

  test('removes a member from a workspace', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);
    const member = await registerUser();

    const inviteRes = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/invitations`,
      cookies: owner.cookies,
      body: { email: member.email, role: 'analyst', expiresInDays: 7 },
    });

    await api({
      method: 'post',
      path: `/api/v1/invitations/${inviteRes.body.invitation.token}/accept`,
      cookies: member.cookies,
    });

    const removeRes = await api({
      method: 'delete',
      path: `/api/v1/workspaces/${workspace.id}/members/${member.user.id}`,
      cookies: owner.cookies,
    });

    expect(removeRes.status).toBe(200);
  });
});

describe('Workspaces — Roles and Permissions', () => {
  test('owner can update a member role', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);
    const member = await registerUser();

    const inviteRes = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/invitations`,
      cookies: owner.cookies,
      body: { email: member.email, role: 'analyst', expiresInDays: 7 },
    });

    await api({
      method: 'post',
      path: `/api/v1/invitations/${inviteRes.body.invitation.token}/accept`,
      cookies: member.cookies,
    });

    const updateRes = await api({
      method: 'patch',
      path: `/api/v1/workspaces/${workspace.id}/members/${member.user.id}/role`,
      cookies: owner.cookies,
      body: { role: 'administrator' },
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.membership.role).toBe('administrator');
  });

  test('non-administrator cannot update roles', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);
    const member = await registerUser();
    const other = await registerUser();

    const inviteRes = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/invitations`,
      cookies: owner.cookies,
      body: { email: member.email, role: 'viewer', expiresInDays: 7 },
    });
    await api({
      method: 'post',
      path: `/api/v1/invitations/${inviteRes.body.invitation.token}/accept`,
      cookies: member.cookies,
    });

    const inviteRes2 = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/invitations`,
      cookies: owner.cookies,
      body: { email: other.email, role: 'analyst', expiresInDays: 7 },
    });
    await api({
      method: 'post',
      path: `/api/v1/invitations/${inviteRes2.body.invitation.token}/accept`,
      cookies: other.cookies,
    });

    const updateRes = await api({
      method: 'patch',
      path: `/api/v1/workspaces/${workspace.id}/members/${other.user.id}/role`,
      cookies: member.cookies,
      body: { role: 'administrator' },
    });

    expect(updateRes.status).toBe(403);
  });

  test('returns the current user\'s effective permissions', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${workspace.id}/permissions/me`,
      cookies: owner.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body.permissions.length).toBeGreaterThan(0);
  });
});

describe('Workspaces — Isolation', () => {
  test('a user cannot access a workspace they are not a member of', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();

    const ws1 = await createWorkspace(auth1);

    const res = await api({
      method: 'get',
      path: `/api/v1/workspaces/${ws1.id}`,
      cookies: auth2.cookies,
    });

    expect(res.status).toBe(404);
  });

  test('a user cannot remove themselves if they are the last owner', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);

    const res = await api({
      method: 'delete',
      path: `/api/v1/workspaces/${workspace.id}/members/${owner.user.id}`,
      cookies: owner.cookies,
    });

    expect(res.status).toBe(409);
  });
});

describe('Workspaces — Ownership Transfer', () => {
  test('owner can initiate ownership transfer', async () => {
    const owner = await registerUser();
    const workspace = await createWorkspace(owner);
    const member = await registerUser();

    const inviteRes = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/invitations`,
      cookies: owner.cookies,
      body: { email: member.email, role: 'administrator', expiresInDays: 7 },
    });

    await api({
      method: 'post',
      path: `/api/v1/invitations/${inviteRes.body.invitation.token}/accept`,
      cookies: member.cookies,
    });

    const transferRes = await api({
      method: 'post',
      path: `/api/v1/workspaces/${workspace.id}/ownership-transfers`,
      cookies: owner.cookies,
      body: {
        newOwnerUserId: member.user.id,
        reason: 'Handing over to my co-founder',
      },
    });

    expect(transferRes.status).toBe(201);
    expect(transferRes.body.transfer.newOwnerUserId).toBe(member.user.id);
    expect(transferRes.body.transfer.status).toBe('pending');
  });
});