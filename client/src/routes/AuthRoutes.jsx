import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { ROUTES } from '../config/routes.config.js';
import { selectIsAuthenticated } from '../features/auth/authSlice.js';

const Login = lazy(() => import('../features/auth/Login.jsx'));
const Register = lazy(() => import('../features/auth/Register.jsx'));
const ForgotPassword = lazy(() => import('../features/auth/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('../features/auth/ResetPassword.jsx'));
const VerifyEmail = lazy(() => import('../features/auth/VerifyEmail.jsx'));
const TwoFactorVerify = lazy(() => import('../features/auth/TwoFactorVerify.jsx'));
const AccountRecovery = lazy(() => import('../features/auth/AccountRecovery.jsx'));

export function AuthRoutes() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (isAuthenticated) {
    return <Navigate to={ROUTES.app.dashboard} replace />;
  }

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="login"
          element={<Suspense fallback={<LoadingState />}><Login /></Suspense>}
        />
        <Route
          path="register"
          element={<Suspense fallback={<LoadingState />}><Register /></Suspense>}
        />
        <Route
          path="forgot-password"
          element={<Suspense fallback={<LoadingState />}><ForgotPassword /></Suspense>}
        />
        <Route
          path="reset-password"
          element={<Suspense fallback={<LoadingState />}><ResetPassword /></Suspense>}
        />
        <Route
          path="verify-email"
          element={<Suspense fallback={<LoadingState />}><VerifyEmail /></Suspense>}
        />
        <Route
          path="mfa"
          element={<Suspense fallback={<LoadingState />}><TwoFactorVerify /></Suspense>}
        />
        <Route
          path="account-recovery"
          element={<Suspense fallback={<LoadingState />}><AccountRecovery /></Suspense>}
        />
      </Route>
    </Routes>
  );
}