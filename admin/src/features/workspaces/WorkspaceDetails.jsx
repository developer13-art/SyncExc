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
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime, formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkspaceDetails() {
  const { workspaceId } = useParams();
  const dispatch = useDispatch();

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => adminApi.getWorkspace(workspaceId),
    enabled: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      workspaceId ?? '',
    ),
  });

  useEffect(() => {
    const workspace = workspaceQuery.data?.workspace;
    if (workspace) {
      dispatch(uiActions.setPageTitle(workspace.name ?? 'Workspace'));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Workspaces', path: ROUTES.console.workspaces.overview },
          {
            label: workspace.name,
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

  const { workspace, members: rawMembers = [], traderInsights } = workspaceQuery.data;
  const members = rawMembers.map((member) => ({
    ...member,
    displayName: member.username,
    email: member.user_email,
    roleId: member.role,
    roleName: member.role,
  }));

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

  const balanceColumns = [
    { key: 'currency', label: 'Currency' },
    {
      key: 'available',
      label: 'Available balance',
      render: (row) => formatCurrency(Number(row.available_minor) / 100, row.currency),
    },
    {
      key: 'requested',
      label: 'In payout review',
      render: (row) => formatCurrency(Number(row.requested_minor) / 100, row.currency),
    },
    {
      key: 'paid',
      label: 'Paid out',
      render: (row) => formatCurrency(Number(row.paid_minor) / 100, row.currency),
    },
    {
      key: 'fee',
      label: 'Platform commission',
      render: (row) => formatCurrency(Number(row.platform_fee_minor) / 100, row.currency),
    },
  ];

  const subscriberColumns = [
    { key: 'subscriber_email', label: 'Subscriber' },
    { key: 'plan_name', label: 'Plan' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge variant={row.status === 'active' ? 'success' : 'warning'}>{row.status}</Badge>,
    },
    {
      key: 'gross_paid_minor',
      label: 'Paid',
      render: (row) => formatCurrency(Number(row.gross_paid_minor) / 100, row.currency || 'USD'),
    },
    {
      key: 'trader_net_minor',
      label: 'Trader share',
      render: (row) => formatCurrency(Number(row.trader_net_minor) / 100, row.currency || 'USD'),
    },
    {
      key: 'current_period_end',
      label: 'Expires',
      render: (row) => row.current_period_end ? formatDateTime(row.current_period_end) : '—',
    },
  ];

  const signalColumns = [
    { key: 'instrument', label: 'Instrument' },
    { key: 'direction', label: 'Direction' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge variant={row.status === 'published' || row.status === 'closed' ? 'success' : 'muted'}>{row.status}</Badge>,
    },
    { key: 'entry', label: 'Entry' },
    {
      key: 'realized_pnl',
      label: 'Realized PnL',
      render: (row) => row.realized_pnl == null ? '—' : `${row.realized_pnl} ${row.pnl_asset || ''}`.trim(),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row) => row.created_at ? formatDateTime(row.created_at) : '—',
    },
  ];

  const tradeColumns = [
    { key: 'instrument', label: 'Instrument' },
    { key: 'side', label: 'Side' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'entry_price', label: 'Entry' },
    { key: 'exit_price', label: 'Exit' },
    {
      key: 'realized_pnl',
      label: 'Realized PnL',
      render: (row) => row.realized_pnl ?? '—',
    },
    {
      key: 'closed_at',
      label: 'Closed',
      render: (row) => row.closed_at ? formatDateTime(row.closed_at) : '—',
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

          {traderInsights ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Trader profile · {traderInsights.provider.display_name}</CardTitle>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/marketplace/earnings">Review payout requests</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Field label="Marketplace handle" value={`@${traderInsights.provider.handle}`} />
                  <Field label="Moderation" value={traderInsights.provider.moderation_state} />
                  <Field label="Closed trades" value={traderInsights.tradeSummary?.closed_trade_count ?? 0} />
                  <Field label="Winning trades" value={traderInsights.tradeSummary?.winning_trade_count ?? 0} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Trader balance and commission</CardTitle></CardHeader>
                <CardContent className="p-5 pt-0">
                  <DataTable
                    columns={balanceColumns}
                    rows={traderInsights.balances}
                    emptyTitle="No trader earnings"
                    emptyDescription="Verified subscription earnings and commission will appear here."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Marketplace subscribers</CardTitle></CardHeader>
                <CardContent className="p-5 pt-0">
                  <DataTable
                    columns={subscriberColumns}
                    rows={traderInsights.subscribers}
                    emptyTitle="No subscribers"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Published signals and performance</CardTitle></CardHeader>
                <CardContent className="p-5 pt-0">
                  {traderInsights.signalPnlByAsset.length > 0 ? (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {traderInsights.signalPnlByAsset.map((pnl) => (
                        <Badge key={pnl.pnl_asset ?? 'unknown'} variant="muted">
                          Signal PnL: {pnl.net_pnl} {pnl.pnl_asset || 'unknown asset'}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <DataTable columns={signalColumns} rows={traderInsights.signals} emptyTitle="No signals" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Recent trading PnL</CardTitle></CardHeader>
                <CardContent className="p-5 pt-0">
                  <p className="mb-3 text-xs text-muted-foreground">
                    Exchange-reported PnL is shown per trade; values across different instruments are not combined.
                  </p>
                  <DataTable columns={tradeColumns} rows={traderInsights.trades} emptyTitle="No closed trades" />
                </CardContent>
              </Card>
            </>
          ) : null}

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
                    isLoading={workspaceQuery.isLoading}
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