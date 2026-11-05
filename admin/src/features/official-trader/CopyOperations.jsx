import { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
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
import { formatPrice, humanize, statusVariant } from './official-trader.utils.js';

function shortId(value) {
  return value ? String(value).slice(0, 8) : '—';
}

export default function CopyOperations() {
  useOfficialTraderPage('Copy operations');
  const [status, setStatus] = useState('');

  const operationsQuery = useQuery({
    queryKey: ['official-trader', 'copy-operations'],
    queryFn: () => officialTraderApi.copyOperations({ limit: 200 }),
  });

  const allRows = operationsQuery.data?.items ?? [];
  const rows = status ? allRows.filter((row) => row.status === status) : allRows;
  const filled = allRows.filter((row) => row.status === 'filled').length;
  const failed = allRows.filter((row) => ['failed', 'rejected', 'error'].includes(row.status)).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Copy operations"
        description="Copy executions are created by the marketplace copy engine in each subscriber's own workspace. Administrators cannot place, modify, or close copied trades on a user's behalf."
      >
        <IconButton label="Refresh copy operations" onClick={() => operationsQuery.refetch()} className="border border-border">
          <RefreshCw className={operationsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </PageHeader>

      <Alert
        variant="info"
        title="Subscriber-owned execution"
        description="Official signals never bypass deterministic validation or subscriber risk checks. Copy operations remain subject to each subscriber's own connection, limits, and pause state."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Copy executions" value={allRows.length} hint="All time" icon={Copy} />
        <StatCard label="Filled" value={filled} hint="Exchange-confirmed" />
        <StatCard label="Failed / rejected" value={failed} hint="Surfaced for review" />
        <StatCard
          label="Distinct subscribers"
          value={new Set(allRows.map((row) => row.user_id)).size}
          hint="Users with copy activity"
        />
      </div>

      <div className="max-w-xs">
        <label className="grid gap-1 text-sm font-medium">
          Operation status
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {[...new Set(allRows.map((row) => row.status).filter(Boolean))].map((value) => (
              <option key={value} value={value}>{humanize(value)}</option>
            ))}
          </select>
        </label>
      </div>

      {operationsQuery.isLoading ? (
        <LoadingState label="Loading copy operations" />
      ) : operationsQuery.isError ? (
        <ErrorState
          title="Copy operations unavailable"
          description={getErrorMessage(operationsQuery.error)}
          onRetry={operationsQuery.refetch}
        />
      ) : (
        <Card>
          <CardHeader><CardTitle>Copy executions</CardTitle></CardHeader>
          <CardContent className="p-5 pt-0">
            <DataTable
              columns={[
                {
                  key: 'created_at',
                  label: 'Created',
                  render: (row) => (
                    <div>
                      <p className="text-sm text-foreground">{formatDateTime(row.created_at)}</p>
                      <p className="text-xs text-muted-foreground">Signal {shortId(row.signal_id)}</p>
                    </div>
                  ),
                },
                {
                  key: 'subscriber',
                  label: 'Subscriber',
                  render: (row) => (
                    <div>
                      <p className="text-sm text-foreground">{row.email || shortId(row.user_id)}</p>
                      <p className="text-xs text-muted-foreground">Workspace {shortId(row.workspace_id)}</p>
                    </div>
                  ),
                },
                {
                  key: 'signal',
                  label: 'Signal',
                  render: (row) => (
                    <div>
                      <p className="text-sm font-medium text-foreground">{row.instrument || '—'}</p>
                      <p className="text-xs text-muted-foreground">{humanize(row.signal_direction)}</p>
                    </div>
                  ),
                },
                {
                  key: 'quantity',
                  label: 'Requested',
                  render: (row) => formatPrice(row.requested_quantity),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge>,
                },
                {
                  key: 'order',
                  label: 'Order',
                  render: (row) => (
                    <span className="font-mono text-xs text-muted-foreground">{shortId(row.order_id)}</span>
                  ),
                },
                {
                  key: 'error',
                  label: 'Error',
                  render: (row) => (
                    <span className="max-w-[220px] text-xs text-destructive">{row.error_message || '—'}</span>
                  ),
                },
              ]}
              rows={rows}
              emptyTitle="No copy operations"
              emptyDescription="Copy executions from official published signals will appear here."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
