import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';

import { adminAuthApi } from '../api/index.js';
import { queryKeys } from '../hooks/queryKeys.js';
import {
  authActions,
  selectAccessToken,
  selectCurrentAdmin,
  selectIsAuthenticated,
  selectIsBootstrapping,
} from '../features/auth/authSlice.js';

export { selectIsBootstrapping };

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isBootstrapping = useSelector(selectIsBootstrapping);
  const accessToken = useSelector(selectAccessToken);
  const admin = useSelector(selectCurrentAdmin);

  useEffect(() => {
    if (!accessToken || admin) {
      if (isBootstrapping) {
        dispatch(authActions.bootstrappingComplete());
      }
      return;
    }

    let cancelled = false;
    dispatch(authActions.bootstrapping());

    (async () => {
      try {
        const currentAdmin = await adminAuthApi.me();
        if (cancelled) {
          return;
        }
        queryClient.setQueryData(queryKeys.auth.me, currentAdmin);
        dispatch(authActions.adminUpdated(currentAdmin));
        dispatch(authActions.bootstrappingComplete());
      } catch {
        if (cancelled) {
          return;
        }
        dispatch(authActions.sessionExpired());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, admin, isBootstrapping, dispatch, queryClient]);

  const login = useCallback(
    async (credentials) => {
      const result = await adminAuthApi.login(credentials);
      if (result?.mfaRequired) {
        dispatch(authActions.mfaChallengeRequired(result));
        return { mfaRequired: true, challengeToken: result.challengeToken };
      }
      dispatch(authActions.loginSucceeded(result));
      queryClient.setQueryData(queryKeys.auth.me, result.admin);
      return { success: true };
    },
    [dispatch, queryClient],
  );

  const verifyMfa = useCallback(
    async ({ challengeToken, code, method = 'totp' }) => {
      const result = await adminAuthApi.verifyMfa({ challengeToken, code, method });
      dispatch(authActions.loginSucceeded(result));
      dispatch(authActions.mfaChallengeCleared());
      queryClient.setQueryData(queryKeys.auth.me, result.admin);
      return result;
    },
    [dispatch, queryClient],
  );

  const stepUp = useCallback(
    async (payload) => {
      const result = await adminAuthApi.stepUp(payload);
      if (result?.accessToken) {
        dispatch(
          authActions.tokenRefreshed({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
          }),
        );
      }
      dispatch(authActions.stepUpCleared());
      return result;
    },
    [dispatch],
  );

  const logout = useCallback(async () => {
    try {
      await adminAuthApi.logout();
    } catch {
      // Ignore logout network errors — clear local state regardless.
    } finally {
      dispatch(authActions.logoutFulfilled());
      queryClient.clear();
    }
  }, [dispatch, queryClient]);

  const value = useMemo(
    () => ({
      admin: admin ?? null,
      isAuthenticated,
      isBootstrapping,
      login,
      verifyMfa,
      stepUp,
      logout,
    }),
    [admin, isAuthenticated, isBootstrapping, login, verifyMfa, stepUp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}