import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Mail, ShieldQuestion } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { identityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { isValidEmail } from '../../lib/validators/email.validator.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';
import { APP } from '../../lib/constants/app.constants.js';

export default function AccountRecovery() {
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ email: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const next = {};
    if (!form.email.trim()) {
      next.email = 'Email address is required';
    } else if (!isValidEmail(form.email)) {
      next.email = 'Please enter a valid email address';
    }
    if (!form.reason.trim()) {
      next.reason = 'Please describe your recovery situation';
    } else if (form.reason.trim().length < 20) {
      next.reason = 'Please provide at least 20 characters';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await identityApi.forgotPassword({ email: form.email.trim().toLowerCase() });
      setSubmitted(true);
      toast.success('Recovery request received', {
        description: 'Check your email for further instructions.',
      });
    } catch (err) {
      const message = getErrorMessage(err);
      if (/not found|invalid/i.test(message)) {
        setSubmitted(true);
      } else {
        setFormError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Recovery request received
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            If an account exists for <strong className="text-foreground">{form.email}</strong>,
            we will follow up with instructions. If you have access to your registered email,
            you can also try the standard password reset.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild className="flex-1">
            <Link to={ROUTES.auth.login}>Back to sign in</Link>
          </Button>
          <Button asChild className="flex-1">
            <Link to={ROUTES.auth.forgotPassword}>Password reset</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <ShieldQuestion className="h-5 w-5 text-primary" />
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Account recovery
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Use this if you have lost access to your MFA device and recovery codes, or cannot
          complete the standard password reset.
        </p>
      </div>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex gap-2 p-4 pt-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-muted-foreground">
            Recovery requests are reviewed. Please do not include passwords, MFA secrets,
            recovery codes, or exchange API credentials in your description.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <FormField label="Email address" htmlFor="recovery-email" required error={errors.email}>
          <Input
            id="recovery-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={form.email}
            onChange={(e) => updateField('email')(e.target.value)}
            error={errors.email}
          />
        </FormField>

        <FormField
          label="Describe your recovery situation"
          htmlFor="recovery-reason"
          required
          error={errors.reason}
          hint="For example: lost MFA device and no recovery codes. Do not include secrets."
        >
          <Textarea
            id="recovery-reason"
            rows={5}
            value={form.reason}
            onChange={(e) => updateField('reason')(e.target.value)}
            error={errors.reason}
          />
        </FormField>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit recovery request'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Have your recovery codes?{' '}
          <Link to={ROUTES.auth.mfa} className="text-primary hover:underline">
            Use them at sign-in
          </Link>{' '}
          · Need help?{' '}
          <a
            href={`mailto:${APP.SUPPORT_EMAIL}`}
            className="text-primary hover:underline"
          >
            {APP.SUPPORT_EMAIL}
          </a>
        </p>
      </form>
    </div>
  );
}