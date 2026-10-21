import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Camera, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Button } from '../../components/ui/Button.jsx';
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
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInput = useRef(null);
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

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      await identityApi.uploadAvatar(file);
      await refreshUser?.();
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error('Profile picture upload failed', { description: getErrorMessage(err) });
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarRemoval = async () => {
    setAvatarBusy(true);
    try {
      await identityApi.removeAvatar();
      await refreshUser?.();
      toast.success('Profile picture removed');
    } catch (err) {
      toast.error('Profile picture could not be removed', { description: getErrorMessage(err) });
    } finally {
      setAvatarBusy(false);
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
          <CardTitle>Profile picture</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar
            src={user.avatarUrl}
            alt={`${user.displayName}'s profile picture`}
            fallback={user.displayName?.slice(0, 1)?.toUpperCase() || '?'}
            size="xl"
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              JPEG, PNG, or WebP. Maximum file size: 5 MB.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={avatarInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Choose a profile picture"
                onChange={handleAvatarChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={avatarBusy}
                onClick={() => avatarInput.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {avatarBusy ? 'Uploading…' : 'Upload picture'}
              </Button>
              {user.avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={avatarBusy}
                  onClick={handleAvatarRemoval}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

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