import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { TradeStatusBadge } from '../../components/domain/trade/TradeStatusBadge.jsx';
import { useTerminalOrders } from '../../hooks/useTerminal.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function OpenOrders({ workspaceId, accountId }) {
  const toast = useToast();
  const [cancelTarget, setCancelTarget] = useState(null);

  const ordersQuery = useTerminalOrders(workspaceId, {
    accountId: accountId ?? undefined,
    status: 'open',
  });

  const orders = ordersQuery.data?.items ?? [];

  const handleCancel = async () => {
    if (!cancelTarget) {
      return;
    }
    try {
      await ordersQuery.cancelOrder({ orderId: cancelTarget.id });
      toast.success('Cancellation requested', {
        description:
          'The exchange will confirm the final state. An already filled order cannot be cancelled.',
      });
      setCancelTarget(null);
    } catch (error) {
      toast.error('Cancellation failed', { description: getErrorMessage(error) });
    }
  };

  const columns = [
    {
      key: 'createdAt',
      label: 'Time',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
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
            row.side === 'buy' || row.side === 'long' ? 'text-success' : 'text-destructive',
          )}
        >
          {row.side}
        </span>
      ),
    },
    { key: 'type', label: 'Type' },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      render: (row) =>
        row.price ? formatQuantity(row.price, 8) : <span className="text-muted-foreground">Market</span>,
    },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'right',
      render: (row) => formatQuantity(row.quantity, 8),
    },
    {
      key: 'filledQuantity',
      label: 'Filled',
      align: 'right',
      render: (row) => (
        <span className="text-muted-foreground">
          {formatQuantity(row.filledQuantity ?? 0, 8)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <TradeStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.app.terminal.order(row.id)}>View</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCancelTarget(row)}
            disabled={row.status === 'filled' || row.status === 'cancelled'}
          >
            Cancel
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <IconButton
          label="Refresh"
          onClick={() => ordersQuery.refetch()}
          disabled={ordersQuery.isLoading}
          className="border border-border"
        >
          <RefreshCw className={cn('h-4 w-4', ordersQuery.isFetching && 'animate-spin')} />
        </IconButton>
      </div>

      <DataTable
        columns={columns}
        rows={orders}
        isLoading={ordersQuery.isLoading}
        emptyTitle="No open orders"
        emptyDescription="Orders you submit will appear here while open."
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel order?"
        description={
          cancelTarget
            ? `Cancellation requests are sent to the exchange. If the order fills first, the cancellation cannot complete.`
            : ''
        }
        confirmLabel="Request cancellation"
        variant="destructive"
        onConfirm={handleCancel}
      />
    </>
  );
}