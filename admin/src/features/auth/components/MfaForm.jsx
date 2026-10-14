import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';
import { FormError } from '../../../components/forms/FormError.jsx';
import { OtpInput } from '../../../components/forms/OtpInput.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function MfaForm({ onSubmit, onCancel, isSubmitting, formError }) {
  const [mode, setMode] = useState('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const submittedCode = mode === 'totp' ? code : recoveryCode;
    if (!submittedCode || submittedCode.length < 6) {
      setError(mode === 'totp' ? 'Enter the 6-digit code' : 'Enter a recovery code');
      return;
    }

    await onSubmit?.({
      code: submittedCode,
      method: mode === 'totp' ? 'totp' : 'recovery_code',
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Two-factor verification
          </h1>
          <p className="text-xs text-muted-foreground">
            Additional verification is required for administrator access
          </p>
        </div>
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
        <FormError>{error ?? formError}</FormError>

        {mode === 'totp' ? (
          <div className="flex flex-col items-center gap-2">
            <OtpInput value={code} onChange={setCode} length={6} />
          </div>
        ) : (
          <FormField
            label="Recovery code"
            htmlFor="admin-recovery-code"
            hint="Recovery codes are single-use."
          >
            <Input
              id="admin-recovery-code"
              autoFocus
              placeholder="Enter recovery code"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.trim())}
            />
          </FormField>
        )}

        <Button type="submit" disabled={isSubmitting}>
          <KeyRound className="h-4 w-4" />
          {isSubmitting ? 'Verifying…' : 'Verify and continue'}
        </Button>

        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel and return to sign in
          </Button>
        ) : null}
      </form>
    </div>
  );
}