import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { identityApi } from '../../api/index.js';
import { isValidEmail, normalizeEmail } from '../../lib/validators/email.validator.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setError(null);

    if (!email.trim()) {
      setError('Email address is required');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      await identityApi.forgotPassword({ email: normalizeEmail(email) });
      setSubmitted(true);
    } catch (err) {
      // Do not reveal whether the account exists, but surface network or server issues.
      const message = getErrorMessage(err);
      if (message && !/not found|invalid/i.test(message)) {
        setFormError(message);
      } else {
        setSubmitted(true);
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
            Check your email
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            If an account exists for <strong className="text-foreground">{email}</strong>, a
            password reset link has been sent. The link expires shortly and can be used once.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={ROUTES.auth.login}>
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Reset your password
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter the email address associated with your account and we will send you a reset
          link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <FormField label="Email address" htmlFor="forgot-email" required error={error}>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) {
                setError(null);
              }
            }}
            error={error}
          />
        </FormField>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
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