import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './client.js';
import { automationApi } from './automation.api.js';

vi.mock('./client.js', () => ({
  default: {
    get: vi.fn(),
    getPaged: vi.fn(),
    post: vi.fn(),
  },
}));

describe('automationApi workflow definitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends workflow validation data in the definition shape expected by the API', async () => {
    const definition = { nodes: [], edges: [], input: {} };
    api.post.mockResolvedValue({ valid: false });

    await automationApi.validateWorkflow('workflow-1', definition);

    expect(api.post).toHaveBeenCalledWith(
      '/automation/workflows/workflow-1/validate',
      definition,
    );
  });

  it('creates a draft version from the workflow definition', async () => {
    const definition = { nodes: [], edges: [], input: {} };
    api.post.mockResolvedValue({ id: 'version-2' });

    await automationApi.createDraftVersion('workflow-1', definition);

    expect(api.post).toHaveBeenCalledWith(
      '/automation/workflows/workflow-1/versions',
      definition,
    );
  });

  it('lists workflow runs using the server route and cursor query', async () => {
    api.getPaged.mockResolvedValue({ items: [], meta: {} });

    await automationApi.listRuns('workflow-1', {
      limit: 25,
      cursor: 'next-page',
      state: 'failed',
    });

    expect(api.getPaged).toHaveBeenCalledWith(
      '/automation/workflows/workflow-1/runs',
      { params: { limit: 25, cursor: 'next-page', state: 'failed' } },
    );
  });

  it('loads run details from the server run route', async () => {
    api.get.mockResolvedValue({ run: { id: 'run-1' }, steps: [] });

    await automationApi.getRun('run-1');

    expect(api.get).toHaveBeenCalledWith('/automation/runs/run-1');
  });
});
