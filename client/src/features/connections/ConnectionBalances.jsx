import { RefreshCw } from 'lucide-react';

import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { queryKeys } from '../../hooks/queryKeys.js';
import { connectionsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { cn } from '../../lib/utils/cn.util.js';

export function ConnectionBalances({ connectionId }) {
  const balancesQuery = useQuery({
    queryKey: queryKeys.connections.balances(connectionId),
    queryFn: async () => {
      const accounts = await connectionsApi.listAccounts(connectionId);
      const accountBalances = await Promise.all(
        accounts.map(async (account) => {
          const snapshot = await connectionsApi.listBalances(account.id);
          return (snapshot.items ?? []).map((item) => ({
            ...item,
            accountId: account.id,
            accountType: account.accountType,
            available: item.free,
            reserved: item.used,
            updatedAt: snapshot.observedAt,
          }));
        }),
      );
      return accountBalances.flat();
    },
    enabled: Boolean(connectionId),
    refetchInterval: 60_000,
  });

  const balances = balancesQuery.data ?? [];

  const columns = [
    {
      key: 'accountType',
      label: 'Account',
      render: (row) => <span className="text-muted-foreground">{row.accountType ?? '—'}</span>,
    },
    {
      key: 'asset',
      label: 'Asset',
      render: (row) => <span className="font-medium text-foreground">{row.asset}</span>,
    },
    {
      key: 'available',
      label: 'Available',
      align: 'right',
      render: (row) => formatQuantity(row.available, 8),
    },
    {
      key: 'reserved',
      label: 'Reserved',
      align: 'right',
      render: (row) => (
        <span className="text-muted-foreground">{formatQuantity(row.reserved ?? 0, 8)}</span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (row) => formatQuantity(row.total ?? row.available, 8),
    },
    {
      key: 'valuation',
      label: 'Est. value',
      align: 'right',
      render: (row) =>
        row.valuation !== undefined ? (
          formatCurrency(row.valuation, row.valuationCurrency ?? 'USD')
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.updatedAt ? formatRelativeTime(row.updatedAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <IconButton
          label="Refresh"
          onClick={() => balancesQuery.refetch()}
          disabled={balancesQuery.isLoading}
          className="border border-border"
        >
          <RefreshCw className={cn('h-4 w-4', balancesQuery.isFetching && 'animate-spin')} />
        </IconButton>
      </div>

      <DataTable
        columns={columns}
        rows={balances}
        isLoading={balancesQuery.isLoading}
        emptyTitle="No balances available"
        emptyDescription="Balances will appear here after the connection syncs."
      />
    </>
  );
}