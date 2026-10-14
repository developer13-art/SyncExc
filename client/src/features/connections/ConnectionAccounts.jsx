import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useQuery } from '@tanstack/react-query';
import { connectionsApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { cn } from '../../lib/utils/cn.util.js';

export function ConnectionAccounts({ connectionId }) {
  const accountsQuery = useQuery({
    queryKey: queryKeys.connections.accounts(connectionId),
    queryFn: () => connectionsApi.listAccounts(connectionId),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
  });

  const accounts = accountsQuery.data ?? [];

  const columns = [
    {
      key: 'label',
      label: 'Account',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.label ?? row.id}</p>
          <p className="font-mono text-2xs text-muted-foreground">{row.id}</p>
        </div>
      ),
    },
    { key: 'type', label: 'Type' },
    {
      key: 'environment',
      label: 'Environment',
      render: (row) => <Badge variant="muted">{row.environment ?? 'production'}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span
          className={cn(
            'text-xs font-medium',
            row.status === 'active' ? 'text-success' : 'text-muted-foreground',
          )}
        >
          {row.status ?? 'active'}
        </span>
      ),
    },
    {
      key: 'lastRefreshedAt',
      label: 'Last refreshed',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastRefreshedAt ? formatDateTime(row.lastRefreshedAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={accounts}
      isLoading={accountsQuery.isLoading}
      emptyTitle="No accounts discovered"
      emptyDescription="Accounts will appear here after the connection is validated."
    />
  );
}