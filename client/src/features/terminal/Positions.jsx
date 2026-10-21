import { RefreshCw } from 'lucide-react';

import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { PnLIndicator } from '../../components/domain/trade/PnLIndicator.jsx';
import { useTerminalPositions } from '../../hooks/useTerminal.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { cn } from '../../lib/utils/cn.util.js';

export function Positions({ workspaceId, accountId }) {
  const toast = useToast();
  const positionsQuery = useTerminalPositions(workspaceId, {
    accountId: accountId ?? undefined,
    status: 'open',
  });

  const positions = positionsQuery.data ?? [];
  const handleSync = async () => {
    try {
      await positionsQuery.syncAccountState(accountId);
      toast.success('Positions and orders synced from exchange');
    } catch (error) {
      toast.error('Exchange sync failed', { description: getErrorMessage(error) });
    }
  };

  const columns = [
    {
      key: 'instrument',
      label: 'Instrument',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.instrument ?? row.symbol}</p>
          <p className="text-2xs uppercase text-muted-foreground">
            {row.accountLabel ?? ''}
          </p>
        </div>
      ),
    },
    {
      key: 'side',
      label: 'Side',
      render: (row) => (
        <span
          className={cn(
            'text-xs font-semibold uppercase',
            row.side === 'long' || row.side === 'buy' ? 'text-success' : 'text-destructive',
          )}
        >
          {row.side}
        </span>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      align: 'right',
      render: (row) => formatQuantity(row.size ?? row.quantity, 8),
    },
    {
      key: 'entryPrice',
      label: 'Entry',
      align: 'right',
      render: (row) => formatQuantity(row.entryPrice, 8),
    },
    {
      key: 'markPrice',
      label: 'Mark',
      align: 'right',
      render: (row) =>
        row.markPrice ? (
          formatQuantity(row.markPrice, 8)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'leverage',
      label: 'Lev',
      align: 'right',
      render: (row) => (row.leverage ? `${row.leverage}x` : '—'),
    },
    {
      key: 'unrealizedPnl',
      label: 'Unrealized P&L',
      align: 'right',
      render: (row) => (
        <PnLIndicator
          value={row.unrealizedPnl ?? 0}
          percent={row.pnlPercent}
          currency={row.quoteCurrency ?? 'USD'}
        />
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
          label="Sync positions from exchange"
          onClick={handleSync}
          disabled={positionsQuery.isLoading || positionsQuery.isSyncingAccountState || !accountId}
          className="border border-border"
        >
          <RefreshCw className={cn('h-4 w-4', (positionsQuery.isFetching || positionsQuery.isSyncingAccountState) && 'animate-spin')} />
        </IconButton>
      </div>

      <DataTable
        columns={columns}
        rows={positions}
        isLoading={positionsQuery.isLoading}
        emptyTitle="No open positions"
        emptyDescription="Derivatives positions will appear here while open."
      />
    </>
  );
}