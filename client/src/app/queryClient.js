import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

import { isApiError, getErrorMessage, isRetriableError } from '../api/errors.js';

const DEFAULT_STALE_TIME = 30_000;
const DEFAULT_GC_TIME = 5 * 60_000;
const DEFAULT_RETRY = 2;

function shouldRetry(failureCount, error) {
  if (failureCount >= 3) {
    return false;
  }
  return isRetriableError(error);
}

function computeRetryDelay(attemptIndex) {
  const base = Math.min(1000 * 2 ** attemptIndex, 30_000);
  const jitter = Math.random() * 250;
  return base + jitter;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME,
      gcTime: DEFAULT_GC_TIME,
      retry: shouldRetry,
      retryDelay: computeRetryDelay,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      networkMode: 'online',
      throwOnError: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        if (failureCount >= 1) {
          return false;
        }
        return isRetriableError(error) && !isApiError(error, 409);
      },
      retryDelay: computeRetryDelay,
      networkMode: 'online',
      throwOnError: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silentError) {
        return;
      }
      if (query.state.data !== undefined) {
        // Background refetch failed but we have cached data — don't alarm the user.
        return;
      }
      const message = getErrorMessage(error);
      toast.error('Unable to load data', { description: message });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silentError) {
        return;
      }
      const message = getErrorMessage(error);
      toast.error('Operation failed', { description: message });
    },
  }),
});

export function invalidateAll() {
  return queryClient.invalidateQueries();
}

export function clearAll() {
  queryClient.clear();
}