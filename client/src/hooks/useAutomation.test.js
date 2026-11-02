import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { automationApi } from '../api/index.js';
import { useWorkflow } from './useAutomation.js';

vi.mock('../api/index.js', () => ({
  automationApi: {
    getWorkflow: vi.fn(),
    listVersions: vi.fn(),
    listNodeCatalog: vi.fn(),
    listTriggers: vi.fn(),
    listSchedules: vi.fn(),
  },
}));

describe('useWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the current workflow definition and node catalog for the builder', async () => {
    const savedNode = { id: 'trigger-1', type: 'scheduled', config: {} };
    const catalogNode = {
      type: 'scheduled',
      label: 'Scheduled',
      category: 'trigger',
      schema: { fields: [] },
    };
    automationApi.getWorkflow.mockResolvedValue({
      id: 'workflow-1',
      name: 'Scheduled workflow',
      currentVersion: 2,
    });
    automationApi.listVersions.mockResolvedValue([
      { id: 'version-2', version: 2, definition: { nodes: [savedNode], edges: [] } },
      { id: 'version-1', version: 1, definition: { nodes: [], edges: [] } },
    ]);
    automationApi.listNodeCatalog.mockResolvedValue([catalogNode]);
    automationApi.listTriggers.mockResolvedValue([]);
    automationApi.listSchedules.mockResolvedValue([]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(
      () => useWorkflow('workflow-1', { includeNodeCatalog: true }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.workflow?.nodes).toEqual([savedNode]);
      expect(result.current.nodeCatalog).toEqual([catalogNode]);
      expect(result.current.isBuilderLoading).toBe(false);
    });
  });
});
