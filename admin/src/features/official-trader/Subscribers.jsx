import { useMemo, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { officialTraderApi } from '../../api/index.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { PageHeader } from './components/PageHeader.jsx';
import { useOfficialTraderPage } from './hooks/useOfficialTraderPage.js';
import { humanize, statusVariant } from './official-trader.utils.js';

const SUBSCRIPTION_STATUSES = [
  'following', 'subscription_pending', 'active', 'past_due', 'canceled', 'expired', 'suspended', 'access_revoked',
];

function shortId(value) {
  return value ? String(value).slice(0, 8) : '—';
}

export default function Subscribers() {
  useOfficialTraderPage('Subscribers');
  const [status, setStatus] = useState('');

  const subscribersQuery = useQuery({
    queryKey: ['official-trader', 'subscribers'],
    queryFn: () => officialTraderApi.subscribers({ limit: 200 }),
  });

  const rows = useMemo(() => {
    const items = subscribersQuery.data?.items ?? [];
    return status ? items.filter((row) => row.status === status) : items;
  }, [status, subscribersQuery.data]);

  const counts = useMemo(() => {
    const items = subscribersQuery.data?.items ?? [];
    return items.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [subscribersQuery.data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Subscribers"
        description="Subscribers receive official published signals and may copy them into their own workspaces. Subscriber configuration never changes official execution or risk settings."
      >
        <IconButton label="Refresh subscribers" onClick={() => subscribersQuery.refetch()} className="border border-border">
          <RefreshCw className={subscribersQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </PageHeader>

      <Alert
        variant="info"
        title="Read-only oversight"
        description="Administrators can review subscription and entitlement state here. They cannot change a subscriber's personal trading configuration or redirect copied trades."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subscribers" value={rows.length} hint="Matching the current filter" icon={Users} />
        <StatCard label="Active" value={counts.active ?? 0} hint="Current access" />
        <StatCard label="Pending" value={counts.subscription_pending ?? 0} hint="Awaiting activation" />
        <StatCard label="Canceled / expired" value={(counts.canceled ?? 0) + (counts.expired ?? 0)} hint="No current access" />
      </div>

      <div className="max-w-xs">
        <label className="grid gap-1 text-sm font-medium">
          Subscription status
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {SUBSCRIPTION_STATUSES.map((value) => (
              <option key={value} value={value}>{humanize(value)}</option>
            ))}
          </select>
        </label>
      </div>

      {subscribersQuery.isLoading ? (
        <LoadingState label="Loading subscribers" />
      ) : subscribersQuery.isError ? (
        <ErrorState
          title="Subscribers unavailable"
          description={getErrorMessage(subscribersQuery.error)}
          onRetry={subscribersQuery.refetch}
        />
      ) : (
        <Card>
          <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
          <CardContent className="p-5 pt-0">
            <DataTable
              columns={[
                {
                  key: 'subscriber',
                  label: 'Subscriber',
                  render: (row) => (
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {row.display_name || row.email || shortId(row.subscriber_user_id)}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.email || shortId(row.subscriber_user_id)}</p>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge>,
                },
                {
                  key: 'plan',
                  label: 'Plan',
                  render: (row) => (
                    <span className="font-mono text-xs text-muted-foreground">{shortId(row.plan_id)}</span>
                  ),
                },
                {
                  key: 'workspace',
                  label: 'Workspace',
                  render: (row) => (
                    <div className="text-xs text-muted-foreground">
                      <p className="font-mono">{shortId(row.workspace_id)}</p>
                      <p>{humanize(row.role_in_workspace)}</p>
                    </div>
                  ),
                },
                {
                  key: 'period',
                  label: 'Current period',
                  render: (row) => (
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(row.current_period_start)} → {formatDateTime(row.current_period_end)}
                    </span>
                  ),
                },
                {
                  key: 'created_at',
                  label: 'Subscribed',
                  render: (row) => formatDateTime(row.created_at),
                },
                {
                  key: 'canceled_at',
                  label: 'Canceled',
                  render: (row) => (row.canceled_at ? formatDateTime(row.canceled_at) : '—'),
                },
              ]}
              rows={rows}
              emptyTitle="No subscribers"
              emptyDescription="Marketplace subscriptions to the official trader will appear here."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
