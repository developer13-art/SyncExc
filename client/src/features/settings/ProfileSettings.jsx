import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ProfileForm } from './components/ProfileForm.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { identityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { SettingsSectionNav } from './components/SettingsSectionNav.jsx';

export default function ProfileSettings() {
  const dispatch = useDispatch();
  const toast = useToast();
  const { user, refreshUser } = useAuthContext();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Profile'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Profile', path: ROUTES.app.settings.profile },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await identityApi.updateProfile(values);
      await refreshUser?.();
      toast.success('Profile updated');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <LoadingState label="Loading profile" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Profile Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your public profile information. Email changes use a separate protected
          workflow.
        </p>
      </div>
      <SettingsSectionNav activePath={ROUTES.app.settings.profile} />

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            user={user}
            onSubmit={handleSubmit}
            isSubmitting={submitting}
            formError={error}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="mt-1 font-medium text-foreground">{user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.emailVerified ? 'Verified' : 'Email verification pending'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Account created</p>
            <p className="mt-1 font-medium text-foreground">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Country or region is used for availability and localization. It is not identity
          verification.
        </CardContent>
      </Card>
    </div>
  );
}