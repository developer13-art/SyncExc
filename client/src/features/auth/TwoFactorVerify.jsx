import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { OtpInput } from '../../components/forms/OtpInput.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export default function TwoFactorVerify() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { verifyMfa } = useAuthContext();

  const challengeToken = location.state?.challengeToken;
  const redirectTo = location.state?.redirectTo ?? ROUTES.app.dashboard;

  const [mode, setMode] = useState('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!challengeToken) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Verification required
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your two-factor session has expired. Please sign in again.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.auth.login}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const submittedCode = mode === 'totp' ? code : recoveryCode;
    if (!submittedCode || submittedCode.length < 6) {
      setError(mode === 'totp' ? 'Enter the 6-digit code' : 'Enter a recovery code');
      return;
    }

    setSubmitting(true);
    try {
      await verifyMfa({
        challengeToken,
        code: submittedCode,
        method: mode === 'totp' ? 'totp' : 'recovery_code',
      });
      toast.success('Signed in');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <ShieldCheck className="h-5 w-5 text-primary" />
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Two-factor authentication
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === 'totp'
            ? 'Enter the 6-digit code from your authenticator app.'
            : 'Enter one of your saved recovery codes.'}
        </p>
      </div>

      <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => {
            setMode('totp');
            setError(null);
          }}
          className={cn(
            'flex-1 rounded-sm px-3 py-1.5 font-medium transition',
            mode === 'totp'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Authenticator code
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('recovery_code');
            setError(null);
          }}
          className={cn(
            'flex-1 rounded-sm px-3 py-1.5 font-medium transition',
            mode === 'recovery_code'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Recovery code
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError>{error}</FormError>

        {mode === 'totp' ? (
          <div className="flex flex-col items-center gap-2">
            <OtpInput value={code} onChange={setCode} length={6} />
          </div>
        ) : (
          <FormField
            label="Recovery code"
            htmlFor="recovery-code"
            hint="Recovery codes are single-use. They are invalidated immediately after use."
          >
            <Input
              id="recovery-code"
              autoFocus
              placeholder="Enter recovery code"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.trim())}
            />
          </FormField>
        )}

        <Button type="submit" disabled={submitting}>
          <KeyRound className="h-4 w-4" />
          {submitting ? 'Verifying…' : 'Verify and continue'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Lost access to your device?{' '}
          <Link to={ROUTES.auth.accountRecovery} className="text-primary hover:underline">
            Recover your account
          </Link>
        </p>
      </form>
    </div>
  );
}