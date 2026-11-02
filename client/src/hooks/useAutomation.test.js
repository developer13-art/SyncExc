import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { automationApi } from '../api/index.js';
import { useWorkflow, useWorkflowRun, useWorkflowRuns } from './useAutomation.js';

vi.mock('../api/index.js', () => ({
  automationApi: {
    getWorkflow: vi.fn(),
    getRun: vi.fn(),
    listRuns: vi.fn(),
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

  describe('workflow run hooks', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('uses cursor and state filters for workflow run lists', async () => {
      automationApi.listRuns.mockResolvedValue({
        items: [{ id: 'run-1', state: 'failed' }],
        meta: { nextCursor: 'cursor-2' },
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(
        () => useWorkflowRuns({
          workflowId: 'workflow-1',
          status: 'failed',
          limit: 25,
          cursor: 'cursor-1',
        }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.runs).toEqual([{ id: 'run-1', state: 'failed' }]);
      });

      expect(automationApi.listRuns).toHaveBeenCalledWith('workflow-1', {
        limit: 25,
        cursor: 'cursor-1',
        state: 'failed',
      });
      expect(result.current.meta.nextCursor).toBe('cursor-2');
    });

    it('uses the single run-detail response for run data and steps', async () => {
      automationApi.getRun.mockResolvedValue({
        run: { id: 'run-1', state: 'running' },
        steps: [{ id: 'step-1' }],
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useWorkflowRun('run-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.run?.status).toBe('running');
      });

      expect(result.current.steps).toEqual([{ id: 'step-1' }]);
    });
  });
});
