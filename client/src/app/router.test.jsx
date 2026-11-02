import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceContext } from '../context/WorkspaceContext.jsx';
import { WorkspaceRouteGuard } from './router.jsx';

vi.mock('../context/WorkspaceContext.jsx', () => ({
  useWorkspaceContext: vi.fn(),
}));

describe('WorkspaceRouteGuard', () => {
  beforeEach(() => {
    useWorkspaceContext.mockReturnValue({
      activeWorkspace: { type: 'trader' },
      isLoading: false,
      error: null,
    });
  });

  it('allows Trader workspaces to open Automation workflows', () => {
    render(
      <MemoryRouter initialEntries={['/app/automation/new']}>
        <Routes>
          <Route element={<WorkspaceRouteGuard />}>
            <Route path="/app/automation/new" element={<p>Create workflow page</p>} />
          </Route>
          <Route path="/app/trader/dashboard" element={<p>Trader dashboard</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Create workflow page')).toBeInTheDocument();
  });

  it('continues redirecting Trader workspaces away from unrelated app sections', () => {
    render(
      <MemoryRouter initialEntries={['/app/connections']}>
        <Routes>
          <Route element={<WorkspaceRouteGuard />}>
            <Route path="/app/connections" element={<p>Connections page</p>} />
          </Route>
          <Route path="/app/trader/dashboard" element={<p>Trader dashboard</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Trader dashboard')).toBeInTheDocument();
  });
});
