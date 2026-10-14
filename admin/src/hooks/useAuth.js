import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';

import { adminAuthApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';
import {
  authActions,
  selectCurrentAdmin,
  selectIsAuthenticated,
} from '../features/auth/authSlice.js';

export function useAuth() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const currentAdmin = useSelector(selectCurrentAdmin);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const meQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => adminAuthApi.me(),
    enabled: isAuthenticated && !currentAdmin,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });

  const login = useMutation({
    mutationFn: (payload) => adminAuthApi.login(payload),
    onSuccess: (data) => {
      if (data?.mfaRequired) {
        dispatch(authActions.mfaChallengeRequired(data));
        return;
      }
      dispatch(authActions.loginSucceeded(data));
      queryClient.setQueryData(queryKeys.auth.me, data.admin);
    },
  });

  const verifyMfa = useMutation({
    mutationFn: (payload) => adminAuthApi.verifyMfa(payload),
    onSuccess: (data) => {
      dispatch(authActions.loginSucceeded(data));
      dispatch(authActions.mfaChallengeCleared());
      queryClient.setQueryData(queryKeys.auth.me, data.admin);
    },
  });

  const logout = useMutation({
    mutationFn: () => adminAuthApi.logout(),
    onSettled: () => {
      dispatch(authActions.logoutFulfilled());
      queryClient.clear();
    },
  });

  const stepUp = useMutation({
    mutationFn: (payload) => adminAuthApi.stepUp(payload),
    onSuccess: (data) => {
      if (data?.accessToken) {
        dispatch(
          authActions.tokenRefreshed({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          }),
        );
      }
      dispatch(authActions.stepUpCleared());
    },
  });

  const refreshAdmin = useCallback(async () => {
    const admin = await adminAuthApi.me();
    queryClient.setQueryData(queryKeys.auth.me, admin);
    dispatch(authActions.adminUpdated(admin));
    return admin;
  }, [dispatch, queryClient]);

  return {
    admin: currentAdmin ?? meQuery.data ?? null,
    isAuthenticated,
    isLoading: meQuery.isLoading,
    login: login.mutateAsync,
    verifyMfa: verifyMfa.mutateAsync,
    logout: logout.mutateAsync,
    stepUp: stepUp.mutateAsync,
    refreshAdmin,
    isLoggingIn: login.isPending,
    isVerifyingMfa: verifyMfa.isPending,
    isLoggingOut: logout.isPending,
  };
}