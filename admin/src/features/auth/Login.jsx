import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { LoginForm } from './components/LoginForm.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { login } = useAuthContext();

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname ?? ROUTES.console.overview;

  const handleSubmit = async (credentials) => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(credentials);

      if (result?.mfaRequired) {
        navigate(ROUTES.auth.mfa, {
          state: { challengeToken: result.challengeToken, redirectTo },
          replace: true,
        });
        return;
      }

      toast.success('Signed in');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LoginForm onSubmit={handleSubmit} isSubmitting={submitting} formError={error} />
  );
}