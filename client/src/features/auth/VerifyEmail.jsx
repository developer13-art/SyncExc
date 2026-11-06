import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, Mail, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { identityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { isValidEmail } from '../../lib/validators/email.validator.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useQueryClient } from '@tanstack/react-query';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, refreshUser } = useAuthContext();

  const tokenFromUrl = searchParams.get('token');
  const initialEmail = location.state?.email ?? '';

  const [status, setStatus] = useState(tokenFromUrl ? 'verifying' : 'pending');
  const [verifyError, setVerifyError] = useState(null);
  const [resendEmail, setResendEmail] = useState(initialEmail);
  const [resendError, setResendError] = useState(null);
  const [resendFeedback, setResendFeedback] = useState(null);
  const [resending, setResending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expiresInHours, setExpiresInHours] = useState(location.state?.expiresInHours || 24);

  useEffect(() => {
    if (!tokenFromUrl) {
      return;
    }

    let cancelled = false;
    (async () => {
      setStatus('verifying');
      setVerifyError(null);
      try {
        const result = await identityApi.verifyEmail(tokenFromUrl);
        if (cancelled) {
          return;
        }
        setStatus(result?.status === 'already_verified' ? 'already_verified' : 'verified');
        if (isAuthenticated) {
          try {
            await refreshUser?.();
          } catch {
            // Token verification has already succeeded on the server.
          }
          await queryClient.invalidateQueries({
            queryKey: queryKeys.auth.emailVerificationStatus,
          });
        }
        toast.success('Email verified', {
          description: isAuthenticated
            ? 'Your account security status has been updated.'
            : 'Your email address is now verified. You can sign in.',
        });
        navigate(ROUTES.auth.verifyEmail, { replace: true, state: location.state });
      } catch (err) {
        if (cancelled) {
          return;
        }
        const reason = err?.details?.reason;
        if (reason === 'expired') {
          setStatus('expired');
        } else if (reason === 'invalid' || reason === 'used') {
          setStatus('invalid');
        } else {
          setVerifyError(getErrorMessage(err));
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenFromUrl, attempt, navigate, location.state, isAuthenticated, refreshUser, queryClient, toast]);

  const handleResend = async (e) => {
    e.preventDefault();
    setResendError(null);
    setResendFeedback(null);

    if (!isAuthenticated && !resendEmail.trim()) {
      setResendError('Email address is required');
      return;
    }
    if (!isAuthenticated && !isValidEmail(resendEmail)) {
      setResendError('Please enter a valid email address');
      return;
    }

    setResending(true);
    try {
      const result = await identityApi.resendVerification(
        isAuthenticated ? undefined : resendEmail.trim().toLowerCase(),
      );
      if (result?.expiresInHours) {
        setExpiresInHours(result.expiresInHours);
      }
      if (result?.emailSent === true) {
        setResendFeedback({
          kind: 'success',
          message: 'Resend accepted the request. Check your inbox; delivery is not confirmed until the message arrives.',
        });
      } else if (result?.alreadyVerified) {
        setResendFeedback({ kind: 'success', message: 'This account email is already verified.' });
        setStatus('already_verified');
      } else if (result?.emailSent === false) {
        setResendFeedback({
          kind: 'error',
          message: 'We could not submit the email request. Please try again later.',
        });
      } else {
        setResendFeedback({
          kind: 'success',
          message: 'If an unverified account uses that address, a new link will be sent. Check your inbox shortly.',
        });
      }
    } catch (err) {
      setResendError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Verifying your email address…</p>
      </div>
    );
  }

  if (status === 'verified' || status === 'already_verified') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {status === 'already_verified' ? 'Already verified' : 'Email verified'}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {status === 'already_verified'
              ? 'This email address has already been verified.'
              : 'Your email address is verified and your account status has been updated.'}
          </p>
        </div>
        <Button asChild>
          <Link to={isAuthenticated ? ROUTES.app.dashboard : ROUTES.auth.login}>
            {isAuthenticated ? 'Continue to SyncExc' : 'Go to sign in'}
          </Link>
        </Button>
      </div>
    );
  }

  if (status === 'expired' || status === 'invalid' || status === 'error') {
    const expired = status === 'expired';
    return (
      <div className="flex flex-col gap-6">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${expired ? 'bg-warning/10' : 'bg-destructive/10'}`}>
          {expired
            ? <Clock3 className="h-5 w-5 text-warning" />
            : status === 'error'
              ? <ShieldAlert className="h-5 w-5 text-destructive" />
              : <XCircle className="h-5 w-5 text-destructive" />}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {expired ? 'Verification link expired' : status === 'error' ? 'Could not verify email' : 'Invalid verification link'}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {expired
              ? 'This link is no longer valid. Request a new verification link to continue.'
              : status === 'error'
                ? 'A temporary server or network issue prevented verification. You can retry safely.'
                : 'This link is invalid or has already been used. Request a new link to continue.'}
          </p>
        </div>
        {status === 'error' ? (
          <p role="alert" className="text-xs text-muted-foreground">{verifyError}</p>
        ) : null}
        {status === 'error' ? (
          <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            Retry verification
          </Button>
        ) : null}
        {resendFeedback ? (
          <p role="status" className={`text-sm ${resendFeedback.kind === 'error' ? 'text-destructive' : 'text-success'}`}>
            {resendFeedback.message}
          </p>
        ) : null}
        {resendError ? <FormError>{resendError}</FormError> : null}
        <form onSubmit={handleResend} className="flex flex-col gap-4" noValidate>
          {!isAuthenticated ? (
            <FormField label="Email address" htmlFor="verify-email" required>
              <Input
                id="verify-email"
                type="email"
                autoComplete="email"
                value={resendEmail}
                onChange={(event) => setResendEmail(event.target.value)}
              />
            </FormField>
          ) : null}
          <Button type="submit" variant="outline" disabled={resending}>
            {resending ? 'Requesting…' : 'Request a new verification link'}
          </Button>
        </form>
        <Button asChild variant="ghost">
          <Link to={isAuthenticated ? ROUTES.app.settings.profile : ROUTES.auth.login}>
            {isAuthenticated ? 'Back to profile' : 'Back to sign in'}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Mail className="h-5 w-5 text-primary" />
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Verify your email
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {location.state?.emailAccepted === false
            ? 'Your account was created, but the email provider did not accept the verification request. You can safely retry below.'
            : location.state?.emailAccepted === true
              ? 'The email provider accepted a verification email request. Check your inbox and click the link to confirm ownership.'
              : 'Enter your account email below to request a verification link. If a link was already sent, you can continue from your inbox.'}
        </p>
        {resendEmail ? (
          <p className="mt-2 text-sm font-medium text-foreground">Account email: {resendEmail}</p>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-foreground">
          The link expires in {expiresInHours} hours and can only be used once.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          If you do not see it, check your spam folder or request another link below.
        </p>
      </div>

      <form onSubmit={handleResend} className="flex flex-col gap-4" noValidate>
        <FormError>{resendError}</FormError>
        {resendFeedback ? (
          <p role="status" className={`text-sm ${resendFeedback.kind === 'error' ? 'text-destructive' : 'text-success'}`}>
            {resendFeedback.message}
          </p>
        ) : null}

        {!isAuthenticated ? (
          <FormField label="Email address" htmlFor="verify-email" required>
            <Input
              id="verify-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
            />
          </FormField>
        ) : null}

        <Button type="submit" disabled={resending}>
          {resending ? 'Requesting…' : 'Resend verification email'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          <Link to={ROUTES.auth.login} className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}