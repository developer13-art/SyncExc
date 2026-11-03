import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PnLIndicator } from '../../components/domain/trade/PnLIndicator.jsx';
import { useTerminalPositions } from '../../hooks/useTerminal.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { terminalApi } from '../../api/index.js';
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
  const [positionToClose, setPositionToClose] = useState(null);
  const [approvalRequestId, setApprovalRequestId] = useState(null);
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
  const handleClosePosition = async () => {
    if (!positionToClose) return;
    try {
      const result = approvalRequestId
        ? await positionsQuery.confirmPositionClose(approvalRequestId)
        : await positionsQuery.closePosition(positionToClose.id);
      if (result?.requiresConfirmation) {
        setApprovalRequestId(result.executionRequestId);
        toast.warning('Additional approval required', {
          description: result.riskDecision?.reasonCode
            ? `Workspace risk policy requires approval (${result.riskDecision.reasonCode}).`
            : 'Workspace risk policy requires a separate approval before closing.',
        });
        return;
      }

      toast.success(result?.ambiguous ? 'Close order needs reconciliation' : 'Close order submitted', {
        description: result?.ambiguous
          ? 'The exchange response is uncertain. Check the order status before retrying.'
          : `A reduce-only market order was submitted for ${positionToClose.instrument}.`,
      });
      setPositionToClose(null);
      setApprovalRequestId(null);
    } catch (error) {
      toast.error('Could not close position', {
        description: getErrorMessage(error),
      });
    }
  };
  const handleCloseDialogOpenChange = async (open) => {
    if (open) return;
    if (approvalRequestId) {
      try {
        await terminalApi.cancelExecutionConfirmation(workspaceId, approvalRequestId);
      } catch (error) {
        toast.error('Approval request was not canceled', {
          description: getErrorMessage(error),
        });
        return;
      }
    }
    setPositionToClose(null);
    setApprovalRequestId(null);
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
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (row) => (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={positionsQuery.isClosingPosition}
          onClick={() => setPositionToClose(row)}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Close
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Modal
        open={Boolean(positionToClose)}
        onOpenChange={handleCloseDialogOpenChange}
        title={approvalRequestId ? 'Approve position close' : 'Close position?'}
        description={approvalRequestId
          ? 'The close order is waiting for separate workspace risk approval.'
          : 'This submits a market order to reduce this futures position to zero. It does not require opening the exchange app.'}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCloseDialogOpenChange(false)}
              disabled={positionsQuery.isClosingPosition}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleClosePosition}
              disabled={positionsQuery.isClosingPosition}
            >
              {positionsQuery.isClosingPosition
                ? 'Submitting…'
                : approvalRequestId
                  ? 'Approve and close'
                  : 'Submit close order'}
            </Button>
          </>
        }
      >
        {positionToClose ? (
          <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
            <p className="font-medium text-foreground">{positionToClose.instrument}</p>
            <p className="mt-1 text-muted-foreground">
              {positionToClose.side} · {formatQuantity(positionToClose.quantity, 8)} · entry{' '}
              {formatQuantity(positionToClose.entryPrice, 8)}
            </p>
            <p className="mt-2 text-xs text-warning">
              Market execution may incur slippage. Close requests are reduce-only and cannot
              increase this position.
            </p>
          </div>
        ) : null}
      </Modal>
      {accountId ? (
        <div className="mb-3 flex justify-end">
          <IconButton
            label="Sync positions and spot balances from exchange"
            onClick={handleSync}
            disabled={positionsQuery.isLoading || positionsQuery.isSyncingAccountState}
            className="border border-border"
          >
            <RefreshCw className={cn('h-4 w-4', (positionsQuery.isFetching || positionsQuery.isSyncingAccountState) && 'animate-spin')} />
          </IconButton>
        </div>
      ) : null}

      {marketType === 'spot' && accountId ? (
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
        <h3 className="text-sm font-semibold text-foreground">
          {accountId
            ? marketType === 'spot'
              ? 'Open derivatives positions'
              : 'Open positions'
            : 'Open positions across connected accounts'}
        </h3>
        <DataTable
          columns={columns}
          rows={positions}
          isLoading={positionsQuery.isLoading}
          emptyTitle="No open positions"
          emptyDescription={!accountId
            ? 'Positions from all connected accounts will appear here.'
            : marketType === 'spot'
            ? 'Spot holdings are listed separately above.'
            : 'Derivatives positions will appear here while open.'}
        />
      </section>
    </div>
  );
}