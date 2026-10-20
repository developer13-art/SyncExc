import { act, renderHook } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authReducer } from '../features/auth/authSlice.js';
import { workspaceReducer } from '../features/settings/workspaceSlice.js';
import { workspacesApi } from '../api/index.js';
import { useWorkspaceContext, WorkspaceProvider } from './WorkspaceContext.jsx';

vi.mock('../api/index.js', () => ({
  workspacesApi: {
    create: vi.fn(),
    getMyPermissions: vi.fn(),
    list: vi.fn(),
    switchContext: vi.fn(),
    update: vi.fn(),
  },
}));

describe('WorkspaceProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes workspace creation and adds the created workspace to state', async () => {
    const workspace = { id: 'workspace-1', name: 'Trading', type: 'trader' };
    const payload = { name: 'Trading', type: 'trader' };
    workspacesApi.create.mockResolvedValue(workspace);

    const store = configureStore({
      reducer: { auth: authReducer, workspace: workspaceReducer },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }) => (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </QueryClientProvider>
      </Provider>
    );
    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    await act(async () => {
      await expect(result.current.createWorkspace(payload)).resolves.toEqual(workspace);
    });

    expect(workspacesApi.create).toHaveBeenCalledWith(payload);
    expect(result.current.workspaces).toContainEqual(workspace);
    expect(result.current.isCreating).toBe(false);
  });
});
