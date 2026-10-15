import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { PasswordInput } from '../../components/forms/PasswordInput.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { isValidEmail } from '../../lib/validators/email.validator.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { login } = useAuthContext();

  const [form, setForm] = useState({
    email: '',
    password: '',
    remember: true,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname ?? ROUTES.app.dashboard;

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
    if (!form.email.trim()) {
      next.email = 'Email address is required';
    } else if (!isValidEmail(form.email)) {
      next.email = 'Please enter a valid email address';
    }
    if (!form.password) {
      next.password = 'Password is required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        rememberMe: form.remember,
      });

      if (result?.mfaRequired) {
        navigate(ROUTES.auth.mfa, {
          state: { challengeToken: result.challengeToken, redirectTo },
          replace: true,
        });
        return;
      }

      toast.success('Signed in');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message = getErrorMessage(error);
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Sign in to SyncExc
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Welcome back. Enter your credentials to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <FormField label="Email address" htmlFor="login-email" required error={errors.email}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => updateField('email')(e.target.value)}
            error={errors.email}
          />
        </FormField>

        <FormField label="Password" htmlFor="login-password" required error={errors.password}>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={form.password}
            onChange={(e) => updateField('password')(e.target.value)}
            error={errors.password}
          />
        </FormField>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(e) => updateField('remember')(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-ring"
            />
            Keep me signed in on this device
          </label>

          <Link
            to={ROUTES.auth.forgotPassword}
            className="text-xs text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to={ROUTES.auth.register} className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}