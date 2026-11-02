import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from './client.js';
import { automationApi } from './automation.api.js';

vi.mock('./client.js', () => ({
  default: {
    get: vi.fn(),
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
});
