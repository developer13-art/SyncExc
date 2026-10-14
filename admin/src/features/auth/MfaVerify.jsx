import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { MfaForm } from './components/MfaForm.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function MfaVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { verifyMfa } = useAuthContext();

  const challengeToken = location.state?.challengeToken;
  const redirectTo = location.state?.redirectTo ?? ROUTES.console.overview;

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async ({ code, method }) => {
    setError(null);
    setSubmitting(true);
    try {
      await verifyMfa({ challengeToken, code, method });
      toast.success('Verified');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(ROUTES.auth.login, { replace: true });
  };

  return (
    <MfaForm
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={submitting}
      formError={error}
    />
  );
}