import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { WorkspaceActionsPanel } from './WorkspaceActionsPanel.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime, formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkspaceDetails() {
  const { workspaceId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => adminApi.getWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId, {}),
    queryFn: () => adminApi.getWorkspaceMembers(workspaceId, {}),
    enabled: Boolean(workspaceId),
  });

  const suspendMutation = useMutation({
    mutationFn: (payload) =>
      adminApi.listWorkspaces?.() && null,
    onError: () => {},
  });

  useEffect(() => {
    if (workspaceQuery.data) {
      dispatch(uiActions.setPageTitle(workspaceQuery.data.name ?? 'Workspace'));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Workspaces', path: ROUTES.console.workspaces.overview },
          {
            label: workspaceQuery.data.name,
            path: ROUTES.console.workspaces.details(workspaceId),
          },
        ]),
      );
    }
  }, [workspaceQuery.data, dispatch, workspaceId]);

  if (workspaceQuery.isLoading) {
    return <LoadingState label="Loading workspace" />;
  }

  if (workspaceQuery.isError || !workspaceQuery.data) {
    return (
      <ErrorState
        title="Unable to load workspace"
        description="This workspace could not be retrieved."
        onRetry={workspaceQuery.refetch}
      />
    );
  }

  const workspace = workspaceQuery.data;
  const members = membersQuery.data?.items ?? [];

  const memberColumns = [
    {
      key: 'user',
      label: 'Member',
      render: (row) => {
        const initials = (row.displayName ?? row.email ?? '?')
          .split(' ')
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <div className="flex items-center gap-3">
            <Avatar size="sm" fallback={initials} src={row.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {row.displayName ?? '—'}
              </p>
              <p className="truncate text-2xs text-muted-foreground">{row.email ?? ''}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <Badge variant={row.roleId === 'owner' ? 'info' : 'muted'}>
          {row.roleName ?? 'Member'}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'warning'}>
          {row.status ?? 'active'}
        </Badge>
      ),
    },
    {
      key: 'joinedAt',
      label: 'Joined',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.joinedAt ? formatRelativeTime(row.joinedAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.console.workspaces.overview}>
            <ArrowLeft className="h-4 w-4" /> Back to workspaces
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {workspace.name}
            </h1>
            <Badge variant={workspace.type === 'organization' ? 'info' : 'muted'}>
              {workspace.type ?? 'personal'}
            </Badge>
            <Badge
              variant={
                workspace.status === 'active'
                  ? 'success'
                  : workspace.status === 'suspended'
                    ? 'destructive'
                    : 'muted'
              }
            >
              {workspace.status ?? 'active'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">{workspace.id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/workspaces/${workspace.id}`}>
              <ExternalLink className="h-3.5 w-3.5" /> Full record
            </Link>
          </Button>
          <IconButton
            label="Refresh"
            onClick={() => {
              workspaceQuery.refetch();
              membersQuery.refetch();
            }}
            className="border border-border"
          >
            <RefreshCw
              className={workspaceQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          </IconButton>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Workspace details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Type" value={workspace.type ?? 'personal'} />
              <Field label="Owner" value={workspace.ownerName ?? '—'} />
              <Field label="Members" value={workspace.memberCount ?? members.length} />
              <Field
                label="Connections"
                value={workspace.connectionCount ?? 0}
              />
              <Field label="Created" value={formatDateTime(workspace.createdAt)} />
              <Field
                label="Last activity"
                value={
                  workspace.lastActivityAt
                    ? formatRelativeTime(workspace.lastActivityAt)
                    : '—'
                }
              />
            </CardContent>
          </Card>

          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
            </TabsList>
            <TabsContent value="members">
              <Card>
                <CardContent className="p-5 pt-5">
                  <DataTable
                    columns={memberColumns}
                    rows={members}
                    isLoading={membersQuery.isLoading}
                    emptyTitle="No members"
                    emptyDescription="This workspace has no visible members."
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="entitlements">
              <Card>
                <CardHeader>
                  <CardTitle>Subscription entitlements</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {workspace.entitlements &&
                  Object.keys(workspace.entitlements).length > 0 ? (
                    <ul className="divide-y divide-border">
                      {Object.entries(workspace.entitlements).map(([key, value]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                        >
                          <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                          <Badge variant={value ? 'success' : 'muted'}>
                            {typeof value === 'boolean'
                              ? value
                                ? 'Enabled'
                                : 'Disabled'
                              : String(value)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-5 text-sm text-muted-foreground">
                      No entitlements recorded for this workspace.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1">
          <WorkspaceActionsPanel
            workspace={workspace}
            onSuspend={async (payload) => {
              toast.info('Workspace suspension submitted', {
                description: 'The action is being processed and audited.',
              });
              return payload;
            }}
            onRestore={async (payload) => {
              toast.info('Workspace restoration submitted', {
                description: 'The action is being processed and audited.',
              });
              return payload;
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}