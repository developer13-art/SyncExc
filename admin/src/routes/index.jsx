import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { AuthRoutes } from './AuthRoutes.jsx';
import { ConsoleRoutes } from './ConsoleRoutes.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { ROUTES } from '../config/routes.config.js';
import {
  selectIsAuthenticated,
  selectIsBootstrapping,
} from '../features/auth/selector.js';

const AUTH_PREFIXES = ['/login', '/mfa'];

export function AdminRoutes() {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isBootstrapping = useSelector(selectIsBootstrapping);

  const section = useMemo(() => {
    const path = location.pathname;
    if (AUTH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return 'auth';
    }
    return 'console';
  }, [location.pathname]);

  if (isBootstrapping) {
    return <LoadingState fullScreen label="Loading SyncExc Administrator Console" />;
  }

  if (section === 'auth') {
    if (isAuthenticated) {
      return <Navigate to={ROUTES.console.overview} replace />;
    }
    return <AuthRoutes />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.auth.login}
        state={{ from: location }}
        replace
      />
    );
  }

  return <ConsoleRoutes />;
}