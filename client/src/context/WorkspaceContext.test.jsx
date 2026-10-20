import { act, renderHook } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authReducer } from '../features/auth/authSlice.js';
import { workspaceActions, workspaceReducer } from '../features/settings/workspaceSlice.js';
import { workspacesApi } from '../api/index.js';
import { queryKeys } from '../hooks/queryKeys.js';
import { useWorkspaceContext, WorkspaceProvider } from './WorkspaceContext.jsx';

vi.mock('../api/index.js', () => ({
  workspacesApi: {
    create: vi.fn(),
    getMyPermissions: vi.fn(),
    list: vi.fn(),
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

  it('clears cached workspace data before switching to another workspace', async () => {
    const store = configureStore({
      reducer: { auth: authReducer, workspace: workspaceReducer },
    });
    store.dispatch(workspaceActions.workspacesLoaded([
      { id: 'workspace-1', name: 'Trading', type: 'trader', status: 'active' },
      { id: 'workspace-2', name: 'Development', type: 'developer', status: 'active' },
    ]));
    store.dispatch(workspaceActions.setActiveWorkspace('workspace-1'));
    workspacesApi.list.mockResolvedValue({
      items: [
        { id: 'workspace-1', name: 'Trading', type: 'trader', status: 'active' },
        { id: 'workspace-2', name: 'Development', type: 'developer', status: 'active' },
      ],
    });
    workspacesApi.getMyPermissions.mockResolvedValue({ permissions: [] });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
    const clear = vi.spyOn(queryClient, 'clear');
    const wrapper = ({ children }) => (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </QueryClientProvider>
      </Provider>
    );
    const { result } = renderHook(() => useWorkspaceContext(), { wrapper });

    await act(async () => {
      await result.current.switchWorkspace('workspace-2');
    });

    expect(cancelQueries).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
    expect(result.current.activeWorkspaceId).toBe('workspace-2');
  });

  it('can switch to a newly created workspace while Redux is catching up with the refreshed list', async () => {
    const personalWorkspace = {
      id: 'personal-workspace',
      name: 'Personal',
      type: 'personal',
      status: 'active',
    };
    const createdWorkspace = {
      id: 'workspace-new',
      name: 'Trading',
      type: 'trader',
      status: 'active',
    };
    const store = configureStore({
      reducer: { auth: authReducer, workspace: workspaceReducer },
    });
    store.dispatch(workspaceActions.workspacesLoaded([personalWorkspace]));
    store.dispatch(workspaceActions.setActiveWorkspace(personalWorkspace.id));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(queryKeys.workspaces.list({}), {
      items: [personalWorkspace, createdWorkspace],
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
      await result.current.switchWorkspace(createdWorkspace.id);
    });

    expect(result.current.activeWorkspaceId).toBe(createdWorkspace.id);
  });
});
