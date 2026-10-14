import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { LoadingState } from '../components/ui/LoadingState.jsx';
import { ROUTES } from '../config/routes.config.js';
import {
  selectCurrentUser,
  selectIsAuthenticated,
  selectIsBootstrapping,
} from '../features/auth/authSlice.js';

export function ProtectedRoute({ requireEmailVerified = true, children }) {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isBootstrapping = useSelector(selectIsBootstrapping);
  const user = useSelector(selectCurrentUser);

  if (isBootstrapping) {
    return <LoadingState fullScreen label="Loading your account" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.auth.login} state={{ from: location }} replace />;
  }

  if (requireEmailVerified && user && !user.emailVerifiedAt) {
    return <Navigate to={ROUTES.auth.verifyEmail} replace />;
  }

  return children ?? <Outlet />;
}