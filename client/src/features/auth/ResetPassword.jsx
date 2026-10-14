import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { PasswordInput } from '../../components/forms/PasswordInput.jsx';
import { identityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { validatePassword } from '../../lib/validators/password.validator.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const token = searchParams.get('token') ?? '';

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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

  const validate = () => {
    const next = {};
    const passwordResult = validatePassword(form.password);
    if (!form.password) {
      next.password = 'Password is required';
    } else if (!passwordResult.valid) {
      next.password = passwordResult.errors[0];
    }
    if (!form.confirmPassword) {
      next.confirmPassword = 'Please confirm your password';
    } else if (form.confirmPassword !== form.password) {
      next.confirmPassword = 'Passwords do not match';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!token) {
      setFormError('Reset token is missing or invalid. Please request a new link.');
      return;
    }

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await identityApi.resetPassword({
        token,
        password: form.password,
      });
      setDone(true);
      toast.success('Password updated', {
        description: 'Please sign in with your new password.',
      });
      setTimeout(() => navigate(ROUTES.auth.login, { replace: true }), 1500);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Password updated
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Redirecting you to sign in with your new password.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.auth.login}>Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Set a new password
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose a strong password. All other sessions will be revoked after the change.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <FormField
          label="New password"
          htmlFor="reset-password"
          required
          error={errors.password}
        >
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            autoFocus
            value={form.password}
            onChange={(e) => updateField('password')(e.target.value)}
            error={errors.password}
            showStrength
          />
        </FormField>

        <FormField
          label="Confirm password"
          htmlFor="reset-confirm"
          required
          error={errors.confirmPassword}
        >
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => updateField('confirmPassword')(e.target.value)}
            error={errors.confirmPassword}
          />
        </FormField>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
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