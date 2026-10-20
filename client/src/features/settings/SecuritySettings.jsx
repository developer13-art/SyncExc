import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { PasswordChangeForm } from './components/PasswordChangeForm.jsx';
import { MfaSetup } from './components/MfaSetup.jsx';
import { identityApi } from '../../api/index.js';
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

  const mfaQuery = useQuery({
    queryKey: queryKeys.auth.mfaStatus,
    queryFn: () => identityApi.getMfaStatus(),
  });
  const securityEventsQuery = useQuery({
    queryKey: queryKeys.auth.securityEvents({ limit: 10 }),
    queryFn: () => identityApi.getSecurityEvents({ limit: 10 }),
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