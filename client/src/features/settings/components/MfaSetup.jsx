import { useState } from 'react';
import { Copy, Download, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { FormError } from '../../../components/forms/FormError.jsx';
import { OtpInput } from '../../../components/forms/OtpInput.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { identityApi } from '../../../api/index.js';
import { useToast } from '../../../hooks/useToast.js';
import { copyToClipboard } from '../../../lib/utils/clipboard.util.js';
import { downloadText } from '../../../lib/utils/download.util.js';
import { getErrorMessage } from '../../../api/errors.js';

export function MfaSetup({ status, onStatusChange, className }) {
  const toast = useToast();

  const [step, setStep] = useState('idle');
  const [secret, setSecret] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isEnabled = status?.enabled;

  const handleBegin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await identityApi.enrollMfa();
      setSecret(result.secret);
      setQrCode(result.qrCodeUrl ?? result.otpauthUrl);
      setStep('scan');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    setError(null);
    if (!code || code.length < 6) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setSubmitting(true);
    try {
      const result = await identityApi.confirmMfaEnrollment({ code });
      setRecoveryCodes(result.recoveryCodes ?? []);
      setStep('recovery');
      toast.success('MFA enabled');
      onStatusChange?.({ enabled: true, recoveryCodesRemaining: result.recoveryCodes?.length });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySecret = async () => {
    const ok = await copyToClipboard(secret ?? '');
    if (ok) {
      toast.success('Setup key copied');
    } else {
      toast.error('Unable to copy');
    }
  };

  const handleCopyCodes = async () => {
    const ok = await copyToClipboard(recoveryCodes.join('\n'));
    if (ok) {
      toast.success('Recovery codes copied');
    } else {
      toast.error('Unable to copy');
    }
  };

  const handleDownloadCodes = () => {
    downloadText(
      `SyncExc Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n${recoveryCodes.join('\n')}\n\nKeep these codes in a safe place. Each code can be used once.`,
      'syncexc-recovery-codes.txt',
    );
  };

  const handleDisable = async () => {
    setSubmitting(true);
    try {
      await identityApi.disableMfa({ confirm: true });
      toast.success('MFA disabled');
      onStatusChange?.({ enabled: false });
    } catch (err) {
      toast.error('Disable failed', { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateCodes = async () => {
    setSubmitting(true);
    try {
      const result = await identityApi.regenerateRecoveryCodes({});
      setRecoveryCodes(result.recoveryCodes ?? []);
      setStep('recovery');
      toast.success('Recovery codes regenerated', {
        description: 'The previous set is now invalid.',
      });
    } catch (err) {
      toast.error('Regeneration failed', { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'recovery') {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col gap-4 p-5 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Save your recovery codes
              </p>
              <p className="text-xs text-muted-foreground">
                Each code is single-use and will not be shown again.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((rc, i) => (
              <code
                key={i}
                className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-center font-mono text-xs text-foreground"
              >
                {rc}
              </code>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopyCodes}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDownloadCodes}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>

          <Button onClick={() => setStep('idle')}>I have saved my codes</Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'scan') {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col gap-4 p-5 pt-5">
          <p className="text-sm font-medium text-foreground">
            Scan the QR code with your authenticator app
          </p>

          <FormError>{error}</FormError>

          <div className="flex flex-col items-center gap-3">
            {qrCode ? (
              <img
                src={qrCode}
                alt="MFA QR code"
                className="h-48 w-48 rounded-md border border-border bg-white p-2"
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center rounded-md border border-border bg-muted">
                <KeyRound className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

            <div className="w-full">
              <p className="mb-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
                Manual setup key
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 font-mono text-xs text-foreground">
                  {secret}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopySecret}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code to confirm setup
            </p>
            <OtpInput value={code} onChange={setCode} length={6} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep('idle')} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={submitting || code.length < 6}>
              {submitting ? 'Confirming…' : 'Confirm and enable'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-4 p-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {isEnabled ? (
                <ShieldCheck className="h-4 w-4 text-success" />
              ) : (
                <ShieldOff className="h-4 w-4 text-warning" />
              )}
              <p className="text-sm font-semibold text-foreground">
                Two-factor authentication
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isEnabled
                ? `Enabled · ${status?.recoveryCodesRemaining ?? 0} recovery code${(status?.recoveryCodesRemaining ?? 0) !== 1 ? 's' : ''} remaining`
                : 'Add a second factor to protect your account.'}
            </p>
          </div>
        </div>

        <FormError>{error}</FormError>

        {isEnabled ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRegenerateCodes} disabled={submitting}>
              Regenerate recovery codes
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={handleDisable}
              disabled={submitting}
            >
              Disable MFA
            </Button>
          </div>
        ) : (
          <Button onClick={handleBegin} disabled={submitting}>
            <ShieldCheck className="h-4 w-4" /> Enable MFA
          </Button>
        )}

        <Alert variant="info" title="Recovery codes">
          <p className="text-xs">
            Recovery codes are single-use. Regenerating them invalidates the previous set.
            Disabling MFA requires fresh authentication.
          </p>
        </Alert>
      </CardContent>
    </Card>
  );
}