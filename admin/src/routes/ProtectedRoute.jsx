import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { LoadingState } from '../components/ui/LoadingState.jsx';
import { ROUTES } from '../config/routes.config.js';
import {
  selectCurrentAdmin,
  selectIsAuthenticated,
  selectIsBootstrapping,
  selectStepUpRequired,
} from '../features/auth/selector.js';

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isBootstrapping = useSelector(selectIsBootstrapping);
  const admin = useSelector(selectCurrentAdmin);

  if (isBootstrapping) {
    return <LoadingState fullScreen label="Loading administrator session" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.auth.login} state={{ from: location }} replace />;
  }

  if (admin && admin.mfaRequired && !admin.mfaVerifiedAt) {
    return <Navigate to={ROUTES.auth.mfa} replace />;
  }

  return children ?? <Outlet />;
}