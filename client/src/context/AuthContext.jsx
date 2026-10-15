import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';

import { identityApi } from '../api/index.js';
import { queryKeys } from '../hooks/queryKeys.js';
import {
  authActions,
  selectAccessToken,
  selectCurrentUser,
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
  const user = useSelector(selectCurrentUser);

  useEffect(() => {
    if (!accessToken || user) {
      if (isBootstrapping) {
        dispatch(authActions.bootstrappingComplete());
      }
      return;
    }

    let cancelled = false;
    dispatch(authActions.bootstrapping());

    (async () => {
      try {
        const currentUser = await identityApi.getCurrentUser();
        if (cancelled) {
          return;
        }
        queryClient.setQueryData(queryKeys.auth.me, currentUser);
        dispatch(authActions.userUpdated(currentUser));
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
  }, [accessToken, user, isBootstrapping, dispatch, queryClient]);

  const login = useCallback(
    async (credentials) => {
      const result = await identityApi.login(credentials);

      if (result?.mfaRequired) {
        dispatch(authActions.mfaChallengeRequired(result));
        return { mfaRequired: true, challengeToken: result.challengeToken };
      }

      dispatch(authActions.loginSucceeded(result));
      queryClient.setQueryData(queryKeys.auth.me, result.user);
      return { success: true };
    },
    [dispatch, queryClient],
  );

  const register = useCallback(
    (details) => identityApi.register(details),
    [],
  );

  const verifyMfa = useCallback(
    async ({ challengeToken, code, method = 'totp' }) => {
      const result = await identityApi.verifyMfa({ challengeToken, code, method });
      dispatch(authActions.loginSucceeded(result));
      dispatch(authActions.mfaChallengeCleared());
      queryClient.setQueryData(queryKeys.auth.me, result.user);
      return result;
    },
    [dispatch, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await identityApi.logout();
    } catch {
      // Ignore logout network errors — clear local state regardless.
    } finally {
      dispatch(authActions.logoutFulfilled());
      queryClient.clear();
    }
  }, [dispatch, queryClient]);

  const logoutAll = useCallback(async () => {
    try {
      await identityApi.logoutAll();
    } catch {
      // Ignore.
    } finally {
      dispatch(authActions.logoutFulfilled());
      queryClient.clear();
    }
  }, [dispatch, queryClient]);

  const value = useMemo(
    () => ({
      user: user ?? null,
      isAuthenticated,
      isBootstrapping,
      login,
      register,
      verifyMfa,
      logout,
      logoutAll,
    }),
    [user, isAuthenticated, isBootstrapping, login, register, verifyMfa, logout, logoutAll],
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