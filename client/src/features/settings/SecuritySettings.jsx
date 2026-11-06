import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, Pencil, Plus, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { PasswordChangeForm } from './components/PasswordChangeForm.jsx';
import { MfaSetup } from './components/MfaSetup.jsx';
import { identityApi } from '../../api/index.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { SettingsSectionNav } from './components/SettingsSectionNav.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export default function SecuritySettings() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyName, setPasskeyName] = useState('This device');
  const [passkeyError, setPasskeyError] = useState(null);
  const [editingPasskey, setEditingPasskey] = useState(null);

  const mfaQuery = useQuery({
    queryKey: queryKeys.auth.mfaStatus,
    queryFn: () => identityApi.getMfaStatus(),
  });
  const securityEventsQuery = useQuery({
    queryKey: queryKeys.auth.securityEvents({ limit: 10 }),
    queryFn: () => identityApi.getSecurityEvents({ limit: 10 }),
  });
  const passkeysQuery = useQuery({
    queryKey: queryKeys.auth.passkeys,
    queryFn: identityApi.listPasskeys,
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Security'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Security', path: ROUTES.app.settings.security },
      ]),
    );
  }, [dispatch]);

  const handleChangePassword = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await identityApi.changePassword(values);
      toast.success('Password changed', {
        description: 'Other sessions have been revoked according to policy.',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaStatusChange = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.mfaStatus });
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
  };

  const handleRegisterPasskey = async () => {
    setPasskeyError(null);
    if (!window.PublicKeyCredential) {
      setPasskeyError('This browser does not support passkeys.');
      return;
    }

    setPasskeyBusy(true);
    try {
      const options = await identityApi.beginPasskeyRegistration();
      const response = await startRegistration({ optionsJSON: options });
      await identityApi.finishPasskeyRegistration(response, passkeyName.trim() || 'This device');
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.passkeys });
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.securityEvents({ limit: 10 }) });
      toast.success('Passkey added', {
        description: 'Your private credential stays protected by your device.',
      });
    } catch (err) {
      setPasskeyError(
        err?.name === 'NotAllowedError'
          ? 'Passkey setup was cancelled. No device was added.'
          : getErrorMessage(err),
      );
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleRenamePasskey = async (event) => {
    event.preventDefault();
    if (!editingPasskey?.name.trim()) return;
    setPasskeyBusy(true);
    setPasskeyError(null);
    try {
      await identityApi.renamePasskey(editingPasskey.id, editingPasskey.name.trim());
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.passkeys });
      setEditingPasskey(null);
      toast.success('Passkey renamed');
    } catch (err) {
      setPasskeyError(getErrorMessage(err));
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleRemovePasskey = async (passkey) => {
    if (!window.confirm(`Remove "${passkey.name}" from your account?`)) return;
    setPasskeyBusy(true);
    setPasskeyError(null);
    try {
      await identityApi.removePasskey(passkey.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.passkeys });
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.securityEvents({ limit: 10 }) });
      toast.success('Passkey removed');
    } catch (err) {
      setPasskeyError(getErrorMessage(err));
    } finally {
      setPasskeyBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Security Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your password, MFA, and active sessions. Sensitive actions require fresh
          authentication.
        </p>
      </div>
      <SettingsSectionNav activePath={ROUTES.app.settings.security} />

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm
            onSubmit={handleChangePassword}
            isSubmitting={submitting}
            formError={error}
          />
        </CardContent>
      </Card>

      <MfaSetup
        status={mfaQuery.data}
        onStatusChange={handleMfaStatusChange}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary" /> Passkeys
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in with a device passkey using its built-in screen lock, fingerprint, or face recognition.
            SyncExc never receives biometric data.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {passkeyError ? <p role="alert" className="text-sm text-destructive">{passkeyError}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Passkey device name"
              maxLength={64}
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              placeholder="Device name"
              className="sm:max-w-xs"
            />
            <Button type="button" disabled={passkeyBusy} onClick={handleRegisterPasskey}>
              <Plus className="h-4 w-4" />
              {passkeyBusy ? 'Waiting for your device…' : 'Set up passkey'}
            </Button>
          </div>
          {passkeysQuery.isLoading ? (
            <LoadingState label="Loading passkeys" />
          ) : passkeysQuery.isError ? (
            <ErrorState
              title="Passkeys unavailable"
              description={getErrorMessage(passkeysQuery.error)}
              onRetry={passkeysQuery.refetch}
            />
          ) : passkeysQuery.data?.length ? (
            <ul className="divide-y divide-border">
              {passkeysQuery.data.map((passkey) => (
                <li key={passkey.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    {editingPasskey?.id === passkey.id ? (
                      <form onSubmit={handleRenamePasskey} className="flex gap-2">
                        <Input
                          aria-label="Rename passkey"
                          maxLength={64}
                          value={editingPasskey.name}
                          onChange={(event) => setEditingPasskey({ ...editingPasskey, name: event.target.value })}
                        />
                        <Button type="submit" size="sm" disabled={passkeyBusy}>Save</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingPasskey(null)}>Cancel</Button>
                      </form>
                    ) : (
                      <>
                        <p className="font-medium text-foreground">{passkey.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {passkey.deviceType === 'multiDevice' ? 'Synced passkey' : 'Device passkey'}
                          {' · Added '}
                          {formatRelativeTime(passkey.createdAt)}
                          {passkey.lastUsedAt ? ` · Used ${formatRelativeTime(passkey.lastUsedAt)}` : ''}
                        </p>
                      </>
                    )}
                  </div>
                  {editingPasskey?.id !== passkey.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Rename ${passkey.name}`}
                        disabled={passkeyBusy}
                        onClick={() => setEditingPasskey({ id: passkey.id, name: passkey.name })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${passkey.name}`}
                        disabled={passkeyBusy}
                        onClick={() => handleRemovePasskey(passkey)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No passkeys are registered yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent security activity</CardTitle>
        </CardHeader>
        <CardContent>
          {securityEventsQuery.isLoading ? (
            <LoadingState label="Loading security activity" />
          ) : securityEventsQuery.isError ? (
            <ErrorState
              title="Security activity unavailable"
              description={getErrorMessage(securityEventsQuery.error)}
              onRetry={securityEventsQuery.refetch}
            />
          ) : securityEventsQuery.data?.items?.length ? (
            <ul className="divide-y divide-border">
              {securityEventsQuery.data.items.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-foreground">{event.eventType?.replaceAll('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.occurredAt ? formatRelativeTime(event.occurredAt) : 'Time unavailable'}
                    </p>
                  </div>
                  <Badge variant={event.outcome === 'success' ? 'success' : 'warning'}>
                    {event.outcome}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">No security events are available yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          A password change does not silently disable MFA. If you lose access to your
          authenticator, use recovery codes or the account recovery workflow.
        </CardContent>
      </Card>
    </div>
  );
}