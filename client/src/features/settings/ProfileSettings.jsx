import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Camera, CheckCircle2, Mail, ShieldAlert, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ProfileForm } from './components/ProfileForm.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { identityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { SettingsSectionNav } from './components/SettingsSectionNav.jsx';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { isValidEmail } from '../../lib/validators/email.validator.js';

export default function ProfileSettings() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuthContext();
  const [submitting, setSubmitting] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [emailChangeBusy, setEmailChangeBusy] = useState(false);
  const [emailChangeMessage, setEmailChangeMessage] = useState(null);
  const avatarInput = useRef(null);
  const [error, setError] = useState(null);
  const verificationQuery = useQuery({
    queryKey: queryKeys.auth.emailVerificationStatus,
    queryFn: identityApi.getEmailVerificationStatus,
    staleTime: 0,
  });
  const emailVerified = verificationQuery.data?.emailVerified ?? user?.emailVerified;
  const verifiedAt = verificationQuery.data?.verifiedAt ?? user?.emailVerifiedAt;

  useEffect(() => {
    if (!cooldownUntil) return undefined;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (!remaining) setCooldownUntil(0);
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

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

  const handleResendVerification = async () => {
    setResending(true);
    setResendMessage(null);
    try {
      const result = await identityApi.resendVerification();
      if (result?.alreadyVerified) {
        setResendMessage({ type: 'success', text: 'This email address is already verified.' });
        await queryClient.invalidateQueries({ queryKey: queryKeys.auth.emailVerificationStatus });
        await refreshUser?.();
      } else if (result?.emailSent) {
        setResendMessage({
          type: 'success',
          text: 'Your email provider accepted the verification request. Check your inbox; delivery is not confirmed yet.',
        });
        setCooldownUntil(Date.now() + (result.resendCooldownSeconds || 60) * 1000);
      } else {
        setResendMessage({
          type: 'error',
          text: 'The email provider did not accept the request. Please wait briefly and try again.',
        });
        setCooldownUntil(Date.now() + (result?.resendCooldownSeconds || 60) * 1000);
      }
    } catch (err) {
      if (err?.code === 'RATE_LIMITED' && err?.details?.retryAfterSeconds) {
        const retryAfterSeconds = err.details.retryAfterSeconds;
        setCooldownUntil(Date.now() + retryAfterSeconds * 1000);
        setResendMessage({
          type: 'warning',
          text: `A verification request was made recently. Please wait ${retryAfterSeconds} seconds before trying again.`,
        });
      } else {
        setResendMessage({ type: 'error', text: getErrorMessage(err) });
      }
    } finally {
      setResending(false);
    }
  };

  const handleEmailChange = async (event) => {
    event.preventDefault();
    setEmailChangeMessage(null);
    if (!isValidEmail(newEmail)) {
      setEmailChangeMessage({ type: 'error', text: 'Enter a valid new email address.' });
      return;
    }
    if (!emailChangePassword) {
      setEmailChangeMessage({ type: 'error', text: 'Enter your current password to confirm this change.' });
      return;
    }
    setEmailChangeBusy(true);
    try {
      const result = await identityApi.changeEmail({
        newEmail: newEmail.trim().toLowerCase(),
        password: emailChangePassword,
      });
      setEmailChangeMessage(result?.emailSent
        ? { type: 'success', text: 'Your email provider accepted the confirmation request. Your current email stays active until you confirm the link at the new address.' }
        : { type: 'error', text: 'The confirmation email could not be submitted. Your current email address is unchanged; retry to request a new link.' });
    } catch (err) {
      setEmailChangeMessage({ type: 'error', text: getErrorMessage(err) });
    } finally {
      setEmailChangeBusy(false);
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
            <p className="text-muted-foreground">Email address</p>
            <p className="mt-1 break-all font-medium text-foreground">
              {verificationQuery.data?.email || user.email}
            </p>
            <div className="mt-2">
              {emailVerified ? (
                <Badge variant="success" className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                </Badge>
              ) : (
                <Badge variant="warning" className="inline-flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> Not verified
                </Badge>
              )}
            </div>
            {emailVerified ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Email ownership confirmed{verifiedAt ? ` on ${new Date(verifiedAt).toLocaleDateString()}` : ''}.
              </p>
            ) : (
              <div className="mt-3 max-w-xl rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  Your email address has not yet been verified. Verify it to confirm ownership and receive important account notifications.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  disabled={resending || countdown > 0}
                  onClick={handleResendVerification}
                >
                  {resending ? (
                    <><Mail className="h-4 w-4 animate-pulse" /> Requesting…</>
                  ) : countdown > 0 ? (
                    `Resend available in ${countdown}s`
                  ) : (
                    'Resend verification email'
                  )}
                </Button>
                {resendMessage ? (
                  <p
                    role="status"
                    className={`mt-2 text-xs ${
                      resendMessage.type === 'error'
                        ? 'text-destructive'
                        : resendMessage.type === 'warning'
                          ? 'text-warning'
                          : 'text-success'
                    }`}
                  >
                    {resendMessage.text}
                  </p>
                ) : null}
                {verificationQuery.isError ? (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    Verification status could not be refreshed. The resend action remains available.
                  </p>
                ) : null}
              </div>
            )}
            <div className="mt-4">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEmailChangeOpen((open) => !open)}
              >
                {emailChangeOpen ? 'Cancel email change' : 'Change email address'}
              </Button>
              {emailChangeOpen ? (
                <form onSubmit={handleEmailChange} className="mt-3 flex max-w-xl flex-col gap-3">
                  <FormError>
                    {emailChangeMessage?.type === 'error' ? emailChangeMessage.text : null}
                  </FormError>
                  {emailChangeMessage?.type === 'success' ? (
                    <p role="status" className="text-xs text-success">{emailChangeMessage.text}</p>
                  ) : null}
                  <FormField label="New email address" htmlFor="new-account-email" required>
                    <Input
                      id="new-account-email"
                      type="email"
                      autoComplete="email"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                    />
                  </FormField>
                  <FormField label="Current password" htmlFor="email-change-password" required>
                    <Input
                      id="email-change-password"
                      type="password"
                      autoComplete="current-password"
                      value={emailChangePassword}
                      onChange={(event) => setEmailChangePassword(event.target.value)}
                    />
                  </FormField>
                  <p className="text-xs text-muted-foreground">
                    Your current email remains active until you confirm the link sent to the new address.
                  </p>
                  <Button type="submit" size="sm" disabled={emailChangeBusy}>
                    {emailChangeBusy ? 'Requesting…' : 'Send confirmation link'}
                  </Button>
                </form>
              ) : null}
            </div>
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