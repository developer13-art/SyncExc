import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { PnLIndicator } from '../../components/domain/trade/PnLIndicator.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useTerminalTrades } from '../../hooks/useTerminal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { cn } from '../../lib/utils/cn.util.js';

export function TradeHistory({ workspaceId, accountId }) {
  const pagination = usePagination({ initialPageSize: 50 });

  const tradesQuery = useTerminalTrades(workspaceId, {
    accountId: accountId ?? undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const trades = tradesQuery.data?.items ?? [];

  if (tradesQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(tradesQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'closedAt',
      label: 'Date',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.closedAt ? formatDateTime(row.closedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'instrument',
      label: 'Instrument',
      render: (row) => <span className="font-medium text-foreground">{row.instrument ?? row.symbol}</span>,
    },
    {
      key: 'side',
      label: 'Side',
      render: (row) => (
        <span
          className={cn(
            'text-xs font-semibold uppercase',
            row.side === 'buy' || row.side === 'long' ? 'text-success' : 'text-destructive',
          )}
        >
          {row.side}
        </span>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'right',
      render: (row) => formatQuantity(row.filledQuantity ?? row.quantity, 8),
    },
    {
      key: 'entryPrice',
      label: 'Entry Price',
      align: 'right',
      render: (row) => (
        row.entryPrice ? formatQuantity(row.entryPrice, 8) : '—'
      ),
    },
    {
      key: 'averagePrice',
      label: 'Exit / Fill Price',
      align: 'right',
      render: (row) => formatQuantity(row.averagePrice ?? row.price, 8),
    },
    {
      key: 'fees',
      label: 'Fees',
      align: 'right',
      render: (row) =>
        row.fees ? (
          <span className="text-xs text-muted-foreground">{formatQuantity(row.fees, 8)}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'realizedPnl',
      label: 'Realized P&L',
      align: 'right',
      render: (row) => (
        <PnLIndicator
          value={row.realizedPnl}
          percent={row.pnlPercent}
          currency={row.quoteCurrency ?? 'USD'}
        />
      ),
    },
    {
      key: 'account',
      label: 'Account',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.accountLabel ?? '—'}</span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <IconButton
          label="Refresh"
          onClick={() => tradesQuery.refetch()}
          disabled={tradesQuery.isLoading}
          className="border border-border"
        >
          <RefreshCw className={cn('h-4 w-4', tradesQuery.isFetching && 'animate-spin')} />
        </IconButton>
      </div>

      <DataTable
        columns={columns}
        rows={trades}
        isLoading={tradesQuery.isLoading}
        emptyTitle="No trades yet"
        emptyDescription="Completed and filled trades will appear here."
      />

      {pagination.total > pagination.pageSize ? (
        <div className="mt-4 flex justify-end">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={pagination.goToPage}
            hasNext={pagination.hasNext}
            hasPrev={pagination.hasPrev}
          />
        </div>
      ) : null}
    </>
  );
}