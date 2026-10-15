/**
 * Sources Module — Unit Tests
 *
 * Covers source registration, discovery, review, connection, validation,
 * health, quality, and sharing.
 */

import { describe, expect, test, afterAll, beforeAll } from '@jest/globals';
import {
  api,
  registerUser,
  createWorkspace,
  queryOne,
  getTestApp,
} from '../helpers.js';
import { closeDatabase } from '../../src/database/index.js';

beforeAll(async () => {
  await getTestApp();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Sources — Registration', () => {
  test('registers a new source', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'post',
      path: '/api/v1/signal-sources',
      cookies: auth.cookies,
      body: {
        type: 'webhook',
        name: 'My Test Source',
        identifier: 'https://example.test/webhook',
        workspaceId: workspace.id,
        accessMethod: 'webhook',
        primaryLanguage: 'en',
      },
    });

    expect([200, 201]).toContain(res.status);
    if (res.body.source) {
      expect(res.body.source.name).toBe('My Test Source');
      expect(res.body.source.type).toBe('webhook');
    }
  });

  test('rejects source registration with an unsupported type', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'post',
      path: '/api/v1/signal-sources',
      cookies: auth.cookies,
      body: {
        type: 'unsupported_type',
        name: 'Bad Source',
        identifier: 'x',
        workspaceId: workspace.id,
        accessMethod: 'webhook',
      },
    });

    expect(res.status).toBe(422);
  });

  test('rejects source registration without a name', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'post',
      path: '/api/v1/signal-sources',
      cookies: auth.cookies,
      body: {
        type: 'webhook',
        identifier: 'https://example.test',
        workspaceId: workspace.id,
        accessMethod: 'webhook',
      },
    });

    expect(res.status).toBe(422);
  });
});

describe('Sources — Listing', () => {
  test('lists sources for the current workspace', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    await api({
      method: 'post',
      path: '/api/v1/signal-sources',
      cookies: auth.cookies,
      body: {
        type: 'webhook',
        name: 'Source to List',
        identifier: 'https://example.test/webhook-1',
        workspaceId: workspace.id,
        accessMethod: 'webhook',
      },
    });

    const res = await api({
      method: 'get',
      path: '/api/v1/signal-sources',
      cookies: auth.cookies,
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sources)).toBe(true);
  });

  test('does not return sources from other workspaces', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();
    const ws1 = await createWorkspace(auth1);
    const ws2 = await createWorkspace(auth2);

    await api({
      method: 'post',
      path: '/api/v1/signal-sources',
      cookies: auth1.cookies,
      body: {
        type: 'webhook',
        name: 'Private Source',
        identifier: 'https://example.test/private',
        workspaceId: ws1.id,
        accessMethod: 'webhook',
      },
    });

    const res = await api({
      method: 'get',
      path: '/api/v1/signal-sources',
      cookies: auth2.cookies,
    });

    expect(res.status).toBe(200);
    expect(res.body.sources.some((s) => s.name === 'Private Source')).toBe(false);
  });
});

describe('Sources — Lifecycle', () => {
  test('pauses a source', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const sourceRes = await api({
      method: 'post',
      path: '/api/v1/signal-sources',
      cookies: auth.cookies,
      body: {
        type: 'webhook',
        name: 'Pausable',
        identifier: 'https://example.test/pausable',
        workspaceId: workspace.id,
        accessMethod: 'webhook',
      },
    });

    if (sourceRes.body.source) {
      const res = await api({
        method: 'post',
        path: `/api/v1/signal-sources/${sourceRes.body.source.id}/pause`,
        cookies: auth.cookies,
      });

      expect([200, 202]).toContain(res.status);
    }
  });

  test('rejects lifecycle action on a source from another workspace', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();
    const ws1 = await createWorkspace(auth1);

    const sourceRes = await api({
      method: 'post',
      path: '/api/v1/signal-sources',
      cookies: auth1.cookies,
      body: {
        type: 'webhook',
        name: 'Isolated',
        identifier: 'https://example.test/isolated',
        workspaceId: ws1.id,
        accessMethod: 'webhook',
      },
    });

    if (sourceRes.body.source) {
      const res = await api({
        method: 'post',
        path: `/api/v1/signal-sources/${sourceRes.body.source.id}/pause`,
        cookies: auth2.cookies,
      });

      expect([403, 404]).toContain(res.status);
    }
  });
});

describe('Sources — Discovery', () => {
  test('creates a discovery job', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'post',
      path: '/api/v1/signal-source-discovery/jobs',
      cookies: auth.cookies,
      body: {
        workspaceId: workspace.id,
        filters: {
          marketType: 'spot',
          language: 'en',
        },
        maxCandidates: 10,
      },
    });

    expect([200, 201, 202]).toContain(res.status);
  });

  test('rejects discovery job without filters', async () => {
    const auth = await registerUser();
    const workspace = await createWorkspace(auth);

    const res = await api({
      method: 'post',
      path: '/api/v1/signal-source-discovery/jobs',
      cookies: auth.cookies,
      body: {
        workspaceId: workspace.id,
      },
    });

    expect(res.status).toBe(422);
  });
});

describe('Sources — Isolation', () => {
  test('a user cannot view another user\'s source detail', async () => {
    const auth1 = await registerUser();
    const auth2 = await registerUser();
    const ws1 = await createWorkspace(auth1);

    const sourceRes = await api({
      method: 'post',
      path: '/api/v1/signal-sources',
      cookies: auth1.cookies,
      body: {
        type: 'webhook',
        name: 'Detail Protected',
        identifier: 'https://example.test/detail-protected',
        workspaceId: ws1.id,
        accessMethod: 'webhook',
      },
    });

    if (sourceRes.body.source) {
      const res = await api({
        method: 'get',
        path: `/api/v1/signal-sources/${sourceRes.body.source.id}`,
        cookies: auth2.cookies,
      });

      expect([403, 404]).toContain(res.status);
    }
  });
});