import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { ROUTES } from '../config/routes.config.js';
import { selectIsAuthenticated } from '../features/auth/selector.js';

const Login = lazy(() => import('../features/auth/Login.jsx'));
const MfaVerify = lazy(() => import('../features/auth/MfaVerify.jsx'));

export function AuthRoutes() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (isAuthenticated) {
    return <Navigate to={ROUTES.console.overview} replace />;
  }

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="login"
          element={
            <Suspense fallback={<LoadingState />}>
              <Login />
            </Suspense>
          }
        />
        <Route
          path="mfa"
          element={
            <Suspense fallback={<LoadingState />}>
              <MfaVerify />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}