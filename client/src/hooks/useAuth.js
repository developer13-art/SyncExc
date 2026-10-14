import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';

import { identityApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';
import { authActions, selectCurrentUser, selectIsAuthenticated } from '../features/auth/authSlice.js';

export function useAuth() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const currentUser = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const meQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => identityApi.getCurrentUser(),
    enabled: isAuthenticated && !currentUser,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });

  const login = useMutation({
    mutationFn: (payload) => identityApi.login(payload),
    onSuccess: (data) => {
      dispatch(authActions.loginSucceeded(data));
      queryClient.setQueryData(queryKeys.auth.me, data.user);
    },
  });

  const register = useMutation({
    mutationFn: (payload) => identityApi.register(payload),
  });

  const logout = useMutation({
    mutationFn: () => identityApi.logout(),
    onSettled: () => {
      dispatch(authActions.logoutFulfilled());
      queryClient.clear();
    },
  });

  const logoutAll = useMutation({
    mutationFn: () => identityApi.logoutAll(),
    onSettled: () => {
      dispatch(authActions.logoutFulfilled());
      queryClient.clear();
    },
  });

  const refreshUser = useCallback(async () => {
    const user = await identityApi.getCurrentUser();
    queryClient.setQueryData(queryKeys.auth.me, user);
    dispatch(authActions.userUpdated(user));
    return user;
  }, [dispatch, queryClient]);

  return {
    user: currentUser ?? meQuery.data ?? null,
    isAuthenticated,
    isLoading: meQuery.isLoading,
    login: login.mutateAsync,
    register: register.mutateAsync,
    logout: logout.mutateAsync,
    logoutAll: logoutAll.mutateAsync,
    refreshUser,
    isLoggingIn: login.isPending,
    isRegistering: register.isPending,
    isLoggingOut: logout.isPending,
  };
}