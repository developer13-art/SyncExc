import { useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { PublicRoutes } from './PublicRoutes.jsx';
import { AuthRoutes } from './AuthRoutes.jsx';
import { AppRoutes as AppSectionRoutes } from './AppRoutes.jsx';
import { NotFoundRoute } from './NotFoundRoute.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { ROUTES } from '../config/routes.config.js';
import {
  selectIsAuthenticated,
  selectIsBootstrapping,
} from '../features/auth/authSlice.js';

const AUTH_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/mfa', '/account-recovery'];
const APP_PREFIX = '/app';

export function AppRoutes() {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isBootstrapping = useSelector(selectIsBootstrapping);

  const section = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith(APP_PREFIX)) {
      return 'app';
    }
    if (AUTH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return 'auth';
    }
    return 'public';
  }, [location.pathname]);

  if (isBootstrapping) {
    return <LoadingState fullScreen label="Loading SyncExc" />;
  }

  if (section === 'app') {
    if (!isAuthenticated) {
      return (
        <Navigate
          to={ROUTES.auth.login}
          state={{ from: location }}
          replace
        />
      );
    }
    return <AppSectionRoutes />;
  }

  if (section === 'auth') {
    return <AuthRoutes />;
  }

  return (
    <Routes>
      <Route path="/*" element={<PublicRoutes />} />
      <Route path="*" element={<NotFoundRoute />} />
    </Routes>
  );
}

export { NotFoundRoute };