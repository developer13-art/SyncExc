import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { identityApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';
import { useAuthContext } from '../../context/AuthContext.jsx';

export default function VerifyEmailChange() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isAuthenticated, refreshUser } = useAuthContext();
  const [status, setStatus] = useState(token ? 'loading' : 'invalid');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await identityApi.confirmEmailChange(token);
        if (cancelled) return;
        if (isAuthenticated) {
          try {
            await refreshUser?.();
          } catch {
            // The email change has already been confirmed by the server.
          }
        }
        setStatus('success');
        window.history.replaceState({}, '', '/verify-email-change');
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated, refreshUser]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Confirming your new email address…</p>
      </div>
    );
  }

  const success = status === 'success';
  return (
    <div className="flex flex-col gap-6">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${success ? 'bg-success/10' : 'bg-destructive/10'}`}>
        {success
          ? <CheckCircle2 className="h-5 w-5 text-success" />
          : <XCircle className="h-5 w-5 text-destructive" />}
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {success ? 'Email address updated' : 'Could not update email'}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {success
            ? 'The new address is confirmed and verified.'
            : 'This link is invalid, expired, or could not be processed. Your existing email address remains unchanged unless confirmation succeeded.'}
        </p>
        {!success && error ? <p role="alert" className="mt-2 text-xs text-muted-foreground">{error}</p> : null}
      </div>
      <Button asChild>
        <Link to={isAuthenticated ? ROUTES.app.settings.profile : ROUTES.auth.login}>
          {isAuthenticated ? 'Return to profile' : 'Go to sign in'}
        </Link>
      </Button>
    </div>
  );
}
