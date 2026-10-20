import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { ErrorState } from '../components/ui/ErrorState.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { ROUTES } from '../config/routes.config.js';
import { useWorkspaceContext } from '../context/WorkspaceContext.jsx';
import { getErrorMessage } from '../api/errors.js';

export function WorkspaceRouteGuard() {
  const location = useLocation();
  const { activeWorkspace, isLoading, error } = useWorkspaceContext();

  if (isLoading) return <LoadingState fullScreen label="Loading workspace" />;
  if (error && !activeWorkspace) {
    return (
      <ErrorState
        title="Workspace unavailable"
        description={getErrorMessage(error)}
      />
    );
  }

  const traderRoute = location.pathname.startsWith('/app/trader');
  if (activeWorkspace?.type === 'trader' && !traderRoute) {
    return <Navigate to={ROUTES.app.trader.overview} replace />;
  }
  if (activeWorkspace?.type !== 'trader' && traderRoute) {
    return <Navigate to={ROUTES.app.dashboard} replace />;
  }

  return <Outlet />;
}
