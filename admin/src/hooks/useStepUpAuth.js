import { useCallback, useState } from 'react';

import { useAuthContext } from '../context/AuthContext.js';

export function useStepUpAuth() {
  const { stepUp } = useAuthContext();
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const requiresStepUp = useCallback((action) => {
    setError(null);
    setPending(action);
  }, []);

  const cancel = useCallback(() => {
    setPending(null);
    setError(null);
  }, []);

  const confirm = useCallback(
    async ({ code, method = 'totp' }) => {
      if (!pending) {
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        await stepUp({ code, method, reason: pending.reason });
        const action = pending;
        setPending(null);
        // eslint-disable-next-line no-unused-expressions
        await action.run?.();
      } catch (err) {
        setError(err?.message ?? 'Step-up verification failed');
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [pending, stepUp],
  );

  return {
    pending,
    error,
    submitting,
    requiresStepUp,
    cancel,
    confirm,
  };
}