import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Download, KeyRound, ShieldCheck } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { OtpInput } from '../../components/forms/OtpInput.jsx';
import { identityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { copyToClipboard } from '../../lib/utils/clipboard.util.js';
import { downloadText } from '../../lib/utils/download.util.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function TwoFactorSetup() {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState('intro');
  const [secret, setSecret] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  const handleConfirm = async (e) => {
    e.preventDefault();
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
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySecret = async () => {
    const ok = await copyToClipboard(secret);
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
      `SyncExc Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n${recoveryCodes.join('\n')}\n\nKeep these codes in a safe place. Each code can only be used once.`,
      'syncexc-recovery-codes.txt',
    );
  };

  const handleFinish = () => {
    navigate(ROUTES.app.settings.security, { replace: true });
  };

  if (step === 'intro') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Enable two-factor authentication
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Add a second factor to protect your account. Use any TOTP-compatible authenticator
            app.
          </p>
        </div>

        <FormError>{error}</FormError>

        <Card>
          <CardContent className="p-5 pt-5">
            <h3 className="text-sm font-semibold text-foreground">Before you begin</h3>
            <ul className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
              <li>· Have your authenticator app ready to scan a QR code.</li>
              <li>· You will be shown a setup key and recovery codes.</li>
              <li>
                · Recovery codes are single-use. Store them somewhere safe — regenerating them
                invalidates the previous set.
              </li>
              <li>· If you lose both your device and your recovery codes, use account recovery.</li>
            </ul>
          </CardContent>
        </Card>

        <Button onClick={handleBegin} disabled={submitting}>
          {submitting ? 'Preparing…' : 'Begin setup'}
        </Button>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Scan the QR code
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Open your authenticator app and scan this code.
          </p>
        </div>

        <FormError>{error}</FormError>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 pt-6">
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
          </CardContent>
        </Card>

        <form onSubmit={handleConfirm} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code to confirm setup
            </p>
            <OtpInput value={code} onChange={setCode} length={6} />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Confirming…' : 'Confirm and activate'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
        <ShieldCheck className="h-5 w-5 text-success" />
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Save your recovery codes
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Store these codes somewhere safe. Each code can be used once, and they will not be
          shown again.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 pt-5">
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
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={handleCopyCodes}>
          <Copy className="h-4 w-4" /> Copy
        </Button>
        <Button variant="outline" className="flex-1" onClick={handleDownloadCodes}>
          <Download className="h-4 w-4" /> Download
        </Button>
      </div>

      <Button onClick={handleFinish}>I have saved my codes</Button>
    </div>
  );
}