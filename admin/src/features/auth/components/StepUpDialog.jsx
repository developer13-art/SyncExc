import { useState } from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';

import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';
import { FormError } from '../../../components/forms/FormError.jsx';
import { OtpInput } from '../../../components/forms/OtpInput.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function StepUpDialog({ open, onOpenChange, action, onConfirm, error, submitting }) {
  const [mode, setMode] = useState('totp');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const handleConfirm = async () => {
    if (mode === 'totp' && code.length < 6) {
      return;
    }
    if (mode === 'password' && !password) {
      return;
    }
    await onConfirm?.({
      code: mode === 'totp' ? code : password,
      method: mode === 'totp' ? 'totp' : 'password',
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Step-up authentication required"
      description="This action requires re-verification for security."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Verifying…' : 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert variant="warning" title="Additional verification">
          <p className="text-xs">
            {action?.reason
              ? action.reason
              : 'You are about to perform a sensitive administrative operation. Please confirm your identity to continue.'}
          </p>
        </Alert>

        <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('totp')}
            className={cn(
              'flex-1 rounded-sm px-3 py-1.5 font-medium transition',
              mode === 'totp'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Authenticator
          </button>
          <button
            type="button"
            onClick={() => setMode('password')}
            className={cn(
              'flex-1 rounded-sm px-3 py-1.5 font-medium transition',
              mode === 'password'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Password
          </button>
        </div>

        {mode === 'totp' ? (
          <div className="flex flex-col items-center gap-2">
            <OtpInput value={code} onChange={setCode} length={6} autoFocus />
          </div>
        ) : (
          <FormField label="Password" htmlFor="step-up-password" required>
            <Input
              id="step-up-password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
        )}

        <FormError>{error}</FormError>

        {action?.details ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-2xs text-muted-foreground">
            <p className="font-medium text-foreground">Operation summary</p>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono">
              {typeof action.details === 'string'
                ? action.details
                : JSON.stringify(action.details, null, 2)}
            </pre>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <ShieldAlert className="h-3 w-3" />
          <span>
            Step-up is valid for a short window. All step-up operations are recorded in the
            audit history.
          </span>
        </div>
      </div>
    </Modal>
  );
}