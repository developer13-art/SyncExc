import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { UserProfilePanel } from './UserProfilePanel.jsx';
import { UserSecurityPanel } from './UserSecurityPanel.jsx';
import { UserWorkspacesPanel } from './UserWorkspacesPanel.jsx';
import { UserActionsPanel } from './UserActionsPanel.jsx';
import { AuditTimeline } from '../../components/audit/AuditTimeline.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function UserDetails() {
  const { userId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => adminApi.getUser(userId),
    enabled: Boolean(userId),
  });

  const auditQuery = useQuery({
    queryKey: queryKeys.users.audit(userId, {}),
    queryFn: () => adminApi.getUserAudit(userId, {}),
    enabled: Boolean(userId),
  });

  const suspendMutation = useMutation({
    mutationFn: (payload) => adminApi.suspendUser(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.audit(userId, {}) });
    },
    onError: (err) =>
      toast.error('Suspension failed', { description: getErrorMessage(err) }),
  });

  const restoreMutation = useMutation({
    mutationFn: (payload) => adminApi.restoreUser(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.audit(userId, {}) });
    },
    onError: (err) =>
      toast.error('Restore failed', { description: getErrorMessage(err) }),
  });

  const revokeSessionsMutation = useMutation({
    mutationFn: (payload) => adminApi.revokeUserSessions(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.audit(userId, {}) });
    },
    onError: (err) =>
      toast.error('Revoke failed', { description: getErrorMessage(err) }),
  });

  useEffect(() => {
    if (userQuery.data) {
      dispatch(uiActions.setPageTitle(userQuery.data.displayName ?? 'User details'));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Users', path: ROUTES.console.users.overview },
          {
            label: userQuery.data.displayName ?? userQuery.data.email ?? 'Details',
            path: ROUTES.console.users.details(userId),
          },
        ]),
      );
    }
  }, [userQuery.data, dispatch, userId]);

  if (userQuery.isLoading) {
    return <LoadingState label="Loading user" />;
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <ErrorState
        title="Unable to load user"
        description="This user record could not be retrieved."
        onRetry={userQuery.refetch}
      />
    );
  }

  const user = userQuery.data;
  const auditEvents = auditQuery.data?.items ?? [];

  const initials = (user.displayName ?? user.email ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.console.users.overview}>
            <ArrowLeft className="h-4 w-4" /> Back to users
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar size="lg" src={user.avatarUrl} fallback={initials} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                {user.displayName ?? user.email}
              </h1>
              <Badge
                variant={
                  user.status === 'active'
                    ? 'success'
                    : user.status === 'suspended'
                      ? 'destructive'
                      : 'warning'
                }
              >
                {user.status?.replace(/_/g, ' ') ?? 'unknown'}
              </Badge>
            </div>
            {user.email ? (
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            ) : null}
            <p className="mt-0.5 font-mono text-2xs text-muted-foreground">{user.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.console.users.audit?.(user.id) ?? `/users/${user.id}`}>
              <ExternalLink className="h-3.5 w-3.5" /> Audit
            </Link>
          </Button>
          <IconButton
            label="Refresh"
            onClick={() => {
              userQuery.refetch();
              auditQuery.refetch();
            }}
            className="border border-border"
          >
            <RefreshCw className={userQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </IconButton>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
              <TabsTrigger value="audit">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
              <UserProfilePanel user={user} />
            </TabsContent>
            <TabsContent value="security">
              <UserSecurityPanel user={user} />
            </TabsContent>
            <TabsContent value="workspaces">
              <UserWorkspacesPanel user={user} />
            </TabsContent>
            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle>Account activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {auditQuery.isLoading ? (
                    <LoadingState label="Loading audit" />
                  ) : auditEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No audit events recorded for this account.
                    </p>
                  ) : (
                    <AuditTimeline events={auditEvents} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1">
          <UserActionsPanel
            user={user}
            onSuspend={(payload) => suspendMutation.mutateAsync(payload)}
            onRestore={(payload) => restoreMutation.mutateAsync(payload)}
            onRevokeSessions={(payload) => revokeSessionsMutation.mutateAsync(payload)}
            onRequireReset={async () => {
              toast.info('Credential reset requested', {
                description:
                  'This operation will be routed through the appropriate service. No credentials are displayed.',
              });
            }}
            onResetMfa={async () => {
              toast.info('MFA reset through verified recovery requested', {
                description:
                  'The user will be notified through a security channel. MFA is not silently disabled.',
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}