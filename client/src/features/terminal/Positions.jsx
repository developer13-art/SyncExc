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

export function Positions({
  workspaceId,
  accountId,
  accountType,
  marketType,
  balances = [],
  isBalancesLoading = false,
}) {
  const toast = useToast();
  const positionsQuery = useTerminalPositions(workspaceId, {
    accountId: accountId ?? undefined,
    status: 'open',
  });

  const positions = positionsQuery.data ?? [];
  const spotHoldings = balances.filter((balance) =>
    Number.isFinite(Number(balance.total)) && Number(balance.total) > 0,
  );
  const handleSync = async () => {
    try {
      await positionsQuery.syncAccountState(accountId);
      toast.success('Positions, orders, and spot balances synced from exchange');
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
    <div className="flex flex-col gap-4">
      <div className="mb-3 flex justify-end">
        <IconButton
          label="Sync positions and spot balances from exchange"
          onClick={handleSync}
          disabled={positionsQuery.isLoading || positionsQuery.isSyncingAccountState || !accountId}
          className="border border-border"
        >
          <RefreshCw className={cn('h-4 w-4', (positionsQuery.isFetching || positionsQuery.isSyncingAccountState) && 'animate-spin')} />
        </IconButton>
      </div>

      {marketType === 'spot' ? (
        <section className="flex flex-col gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Spot holdings</h3>
            <p className="text-xs text-muted-foreground">
              Coin balances on this exchange account; spot assets are not derivatives positions.
              {accountType ? ` Account type: ${accountType}.` : ''}
            </p>
          </div>
          <DataTable
            columns={[
              { key: 'asset', label: 'Asset' },
              {
                key: 'available',
                label: 'Available',
                align: 'right',
                render: (row) => formatQuantity(row.available ?? row.free ?? 0, 8),
              },
              {
                key: 'used',
                label: 'In orders',
                align: 'right',
                render: (row) => formatQuantity(row.used ?? 0, 8),
              },
              {
                key: 'total',
                label: 'Total',
                align: 'right',
                render: (row) => formatQuantity(row.total, 8),
              },
            ]}
            rows={spotHoldings}
            rowKey={(row) => row.asset}
            isLoading={isBalancesLoading}
            emptyTitle="No spot holdings"
            emptyDescription="After a spot buy fills, sync account state to refresh the balances shown here."
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        {marketType === 'spot' ? (
          <h3 className="text-sm font-semibold text-foreground">Open derivatives positions</h3>
        ) : null}
        <DataTable
          columns={columns}
          rows={positions}
          isLoading={positionsQuery.isLoading}
          emptyTitle="No open derivatives positions"
          emptyDescription={marketType === 'spot'
            ? 'Spot holdings are listed separately above.'
            : 'Derivatives positions will appear here while open.'}
        />
      </section>
    </div>
  );
}