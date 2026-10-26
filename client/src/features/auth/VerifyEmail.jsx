import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail, RefreshCw, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { identityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { isValidEmail } from '../../lib/validators/email.validator.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const tokenFromUrl = searchParams.get('token');
  const initialEmail = location.state?.email ?? '';
  const verificationEmailSent = location.state?.verificationEmailSent;

  const [status, setStatus] = useState(tokenFromUrl ? 'verifying' : 'pending');
  const [error, setError] = useState(null);
  const [resendEmail, setResendEmail] = useState(initialEmail);
  const [resendError, setResendError] = useState(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!tokenFromUrl) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await identityApi.verifyEmail(tokenFromUrl);
        if (cancelled) {
          return;
        }
        setStatus('verified');
        toast.success('Email verified', {
          description: 'You can now sign in to your account.',
        });
        setTimeout(() => navigate(ROUTES.auth.login, { replace: true }), 2000);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(getErrorMessage(err));
        setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenFromUrl, navigate, toast]);

  const handleResend = async (e) => {
    e.preventDefault();
    setResendError(null);

    if (!resendEmail.trim()) {
      setResendError('Email address is required');
      return;
    }
    if (!isValidEmail(resendEmail)) {
      setResendError('Please enter a valid email address');
      return;
    }

    setResending(true);
    try {
      await identityApi.resendVerification(resendEmail.trim().toLowerCase());
      toast.success('Verification email sent', {
        description: 'Check your inbox for the new link.',
      });
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

  if (status === 'verified') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Email verified
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your email address has been verified. Redirecting you to sign in.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.auth.login}>Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Verification failed
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {error ?? 'The verification link is invalid or has expired.'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={ROUTES.auth.login}>Back to sign in</Link>
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
          {verificationEmailSent === false
            ? 'Your account was created, but we could not send the verification email. Request a new link below.'
            : 'We sent a verification link to your email address. Click the link to activate your account.'}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-foreground">Didn&apos;t receive it?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Check your spam folder or request a new link below.
        </p>
      </div>

      <form onSubmit={handleResend} className="flex flex-col gap-4" noValidate>
        <FormError>{resendError}</FormError>

        <FormField label="Email address" htmlFor="verify-email" required>
          <Input
            id="verify-email"
            type="email"
            placeholder="you@example.com"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
          />
        </FormField>

        <Button type="submit" disabled={resending}>
          {resending ? 'Sending…' : 'Resend verification email'}
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