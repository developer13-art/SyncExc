import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';
import { FormError } from '../../../components/forms/FormError.jsx';
import { PasswordInput } from '../../../components/forms/PasswordInput.jsx';

export function LoginForm({ onSubmit, isSubmitting, formError }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!form.email.trim()) {
      next.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
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
    if (!validate()) {
      return;
    }
    await onSubmit?.({
      email: form.email.trim().toLowerCase(),
      password: form.password,
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
            Administrator sign in
          </h1>
          <p className="text-xs text-muted-foreground">
            Authorized staff access only
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <FormField label="Email address" htmlFor="admin-login-email" required error={errors.email}>
          <Input
            id="admin-login-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="admin@syncexc.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="admin-login-password"
          required
          error={errors.password}
        >
          <PasswordInput
            id="admin-login-password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
          />
        </FormField>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
          {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>

        <p className="text-center text-2xs text-muted-foreground">
          MFA is required for administrator accounts. All sign-in attempts are recorded in the
          audit history.
        </p>
      </form>
    </div>
  );
}