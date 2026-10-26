import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { PasswordInput } from '../../components/forms/PasswordInput.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { isValidEmail, normalizeEmail } from '../../lib/validators/email.validator.js';
import { validatePassword } from '../../lib/validators/password.validator.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';
import { referralApi } from '../../api/referral.api.js';
import { storage } from '../../lib/utils/storage.util.js';

const REFERRAL_CODE_STORAGE_KEY = 'syncexc:referral-code';

function normalizeReferralCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{6,32}$/.test(code) ? code : null;
}

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { register } = useAuthContext();
  const trackedCode = useRef(null);
  const queryReferralCode = normalizeReferralCode(searchParams.get('ref'));
  const [referralCode, setReferralCode] = useState(
    () => queryReferralCode ?? normalizeReferralCode(storage.get(REFERRAL_CODE_STORAGE_KEY, null, { parse: false })),
  );

  useEffect(() => {
    if (!queryReferralCode) return;

    storage.set(REFERRAL_CODE_STORAGE_KEY, queryReferralCode, { stringify: false });
    setReferralCode(queryReferralCode);
    if (trackedCode.current === queryReferralCode) return;
    trackedCode.current = queryReferralCode;

    referralApi.trackClick({
      code: queryReferralCode,
      referrer: document.referrer || undefined,
    }).catch((error) => {
      toast.error('Referral link tracking failed', {
        description: getErrorMessage(error),
      });
    });
  }, [queryReferralCode, toast]);

  const [form, setForm] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

    if (!form.displayName.trim()) {
      next.displayName = 'Display name is required';
    } else if (form.displayName.trim().length < 2) {
      next.displayName = 'Display name must be at least 2 characters';
    } else if (form.displayName.trim().length > 64) {
      next.displayName = 'Display name must not exceed 64 characters';
    }

    const username = form.username.trim();
    if (!username) {
      next.username = 'Username is required';
    } else if (username.length < 3 || username.length > 32) {
      next.username = 'Username must be between 3 and 32 characters';
    } else if (!/^[a-z0-9_][a-z0-9_-]*[a-z0-9_]$/i.test(username)) {
      next.username =
        'Username must start and end with a letter or number, and may contain hyphens and underscores';
    }

    if (!form.email.trim()) {
      next.email = 'Email address is required';
    } else if (!isValidEmail(form.email)) {
      next.email = 'Please enter a valid email address';
    }

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

    if (!form.acceptTerms) {
      next.acceptTerms = 'You must accept the terms to continue';
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
      const result = await register({
        displayName: form.displayName.trim(),
        username: form.username.trim().toLowerCase(),
        email: normalizeEmail(form.email),
        password: form.password,
        acceptedTerms: true,
        acceptedPrivacy: true,
        ...(referralCode ? { referralCode } : {}),
      });
      storage.remove(REFERRAL_CODE_STORAGE_KEY);

      toast[result.verificationEmailSent ? 'success' : 'error'](
        result.verificationEmailSent ? 'Account created' : 'Account created, email not sent',
        {
          description: result.verificationEmailSent
            ? 'Please check your email to verify your address.'
            : 'Your account is saved but unverified. Request a verification link below.',
        },
      );
      navigate(ROUTES.auth.verifyEmail, {
        state: {
          email: normalizeEmail(form.email),
          verificationEmailSent: result.verificationEmailSent,
        },
        replace: true,
      });
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Get started with SyncExc. No identity document collection.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError>{formError}</FormError>

        <FormField
          label="Display name"
          htmlFor="register-name"
          required
          error={errors.displayName}
        >
          <Input
            id="register-name"
            autoComplete="name"
            autoFocus
            placeholder="Jane Doe"
            value={form.displayName}
            onChange={(e) => updateField('displayName')(e.target.value)}
            error={errors.displayName}
          />
        </FormField>

        <FormField
          label="Username"
          htmlFor="register-username"
          required
          error={errors.username}
          hint="3–32 characters; letters, numbers, hyphens, and underscores."
        >
          <Input
            id="register-username"
            autoComplete="username"
            placeholder="jane_doe"
            value={form.username}
            onChange={(e) => updateField('username')(e.target.value)}
            error={errors.username}
          />
        </FormField>

        <FormField
          label="Email address"
          htmlFor="register-email"
          required
          error={errors.email}
        >
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => updateField('email')(e.target.value)}
            error={errors.email}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="register-password"
          required
          error={errors.password}
          hint="At least 12 characters with mixed case, number, and symbol."
        >
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            placeholder="Choose a strong password"
            value={form.password}
            onChange={(e) => updateField('password')(e.target.value)}
            error={errors.password}
            showStrength
          />
        </FormField>

        <FormField
          label="Confirm password"
          htmlFor="register-confirm"
          required
          error={errors.confirmPassword}
        >
          <PasswordInput
            id="register-confirm"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={(e) => updateField('confirmPassword')(e.target.value)}
            error={errors.confirmPassword}
          />
        </FormField>

        <FormField error={errors.acceptTerms}>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={form.acceptTerms}
              onChange={(e) => updateField('acceptTerms')(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-input text-primary focus:ring-ring"
            />
            <span>
              I agree to the{' '}
              <Link to={ROUTES.public.terms} className="text-primary hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to={ROUTES.public.privacy} className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </FormField>

        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? 'Creating account…' : 'Create account'}
          {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link to={ROUTES.auth.login} className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}