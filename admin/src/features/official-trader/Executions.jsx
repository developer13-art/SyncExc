import { useState } from 'react';
import { CheckCircle2, Eye, RefreshCw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { JsonViewer } from '../../components/ui/JsonViewer.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { officialTraderApi } from '../../api/index.js';
import { getErrorMessage } from '../../lib/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { useStepUpAuth } from '../../hooks/useStepUpAuth.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { PageHeader } from './components/PageHeader.jsx';
import { ReasonDialog } from './components/ReasonDialog.jsx';
import { StepUpGate } from './components/StepUpGate.jsx';
import { useOfficialTraderPage } from './hooks/useOfficialTraderPage.js';
import {
  formatMoney,
  formatPrice,
  humanize,
  statusVariant,
} from './official-trader.utils.js';

const STATUSES = [
  '', 'pending', 'awaiting_confirmation', 'submitted', 'partially_filled', 'filled',
  'canceled', 'rejected', 'failed', 'uncertain', 'reconciled', 'superseded',
];

export default function ExecutionManagement() {
  useOfficialTraderPage('Execution management');
  const toast = useToast();
  const queryClient = useQueryClient();
  const stepUp = useStepUpAuth();

  const [filters, setFilters] = useState({ status: '', marketType: '' });
  const [detailId, setDetailId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const executionsQuery = useQuery({
    queryKey: ['official-trader', 'executions', filters],
    queryFn: () => officialTraderApi.executions({
      status: filters.status || undefined,
      marketType: filters.marketType || undefined,
      limit: 100,
    }),
  });
  const detailQuery = useQuery({
    queryKey: ['official-trader', 'execution', detailId],
    queryFn: () => officialTraderApi.execution(detailId),
    enabled: Boolean(detailId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['official-trader'] });

  const confirmMutation = useMutation({
    mutationFn: ({ executionId, reason }) =>
      officialTraderApi.confirmExecution(executionId, { reason }),
    onSuccess: () => {
      setConfirmOpen(false);
      setConfirmTarget(null);
      toast.success('Execution confirmed');
      invalidate();
    },
    onError: (error) => toast.error('Confirmation failed', { description: getErrorMessage(error) }),
  });

  const syncMutation = useMutation({
    mutationFn: (executionId) => officialTraderApi.syncExecution(executionId),
    onSuccess: (result) => {
      toast.success('Execution synchronized', {
        description: result?.status ? `Exchange status: ${humanize(result.status)}.` : undefined,
      });
      invalidate();
    },
    onError: (error) => toast.error('Synchronization failed', { description: getErrorMessage(error) }),
  });

  const reconcileMutation = useMutation({
    mutationFn: () => officialTraderApi.reconcile({}),
    onSuccess: (result) => {
      toast.success('Reconciliation completed', {
        description: result?.reconciled == null
          ? 'Exchange records were checked.'
          : `${result.reconciled} execution(s) reconciled.`,
      });
      invalidate();
    },
    onError: (error) => toast.error('Reconciliation failed', { description: getErrorMessage(error) }),
  });

  const columns = [
    {
      key: 'created_at',
      label: 'Created',
      render: (row) => (
        <div>
          <p className="text-sm text-foreground">{formatDateTime(row.created_at)}</p>
          <p className="text-xs text-muted-foreground">
            #{row.execution_number} · {row.exchange_code || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'instrument',
      label: 'Order',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-foreground">
            {row.instrument} · {humanize(row.side)}
          </p>
          <p className="text-xs text-muted-foreground">
            {humanize(row.market_type)} · {humanize(row.order_type)} · {humanize(row.strategy_key)}
          </p>
        </div>
      ),
    },
    {
      key: 'fills',
      label: 'Fill',
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          <p>Requested {formatPrice(row.requested_quantity)}</p>
          <p>Filled {formatPrice(row.filled_quantity)}</p>
          <p>Avg {formatPrice(row.average_fill_price)}</p>
        </div>
      ),
    },
    {
      key: 'fees',
      label: 'Fees',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatMoney(row.fees)} {row.fee_asset || ''}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge>
          {row.published_signal_id ? <Badge variant="info">Published</Badge> : null}
          {row.error_message ? (
            <span className="max-w-[180px] text-xs text-destructive">{row.error_message}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'result',
      label: 'Close',
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          <p>{row.closed_at ? formatDateTime(row.closed_at) : 'Open'}</p>
          {row.closure_outcome ? (
            <Badge variant={statusVariant(row.closure_outcome)}>{humanize(row.closure_outcome)}</Badge>
          ) : null}
          <p>{formatMoney(row.realized_pnl)} {row.pnl_asset || ''}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <IconButton label="View execution" onClick={() => setDetailId(row.id)}>
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Synchronize with exchange"
            onClick={() => syncMutation.mutate(row.id)}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={syncMutation.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </IconButton>
          {row.status === 'awaiting_confirmation' ? (
            <IconButton
              label="Confirm execution"
              onClick={() => {
                setConfirmTarget(row);
                setConfirmOpen(true);
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
            </IconButton>
          ) : null}
        </div>
      ),
    },
  ];

  const detail = detailQuery.data;
  const execution = detail?.execution;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Execution management"
        description="Official executions flow through the deterministic SyncExc order path. Uncertain submissions are marked for reconciliation and never blindly retried. Publication requires confirmed fills."
      >
        <IconButton label="Refresh executions" onClick={() => executionsQuery.refetch()} className="border border-border">
          <RefreshCw className={executionsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
        <Button variant="outline" onClick={() => reconcileMutation.mutate()} disabled={reconcileMutation.isPending}>
          <RefreshCw className={reconcileMutation.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Reconcile now
        </Button>
      </PageHeader>

      <Alert
        variant="warning"
        title="Uncertain outcomes are never retried automatically"
        description="Executions with unknown exchange outcomes stay in reconciliation until verified. Emergency pauses do not cancel exchange-accepted orders or close positions."
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Status
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          >
            {STATUSES.map((status) => (
              <option key={status || 'all'} value={status}>{status ? humanize(status) : 'All statuses'}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Market type
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filters.marketType}
            onChange={(event) => setFilters((current) => ({ ...current, marketType: event.target.value }))}
          >
            <option value="">All markets</option>
            <option value="spot">Spot</option>
            <option value="futures">Futures</option>
          </select>
        </label>
      </div>

      {executionsQuery.isLoading ? (
        <LoadingState label="Loading executions" />
      ) : executionsQuery.isError ? (
        <ErrorState
          title="Executions unavailable"
          description={getErrorMessage(executionsQuery.error)}
          onRetry={executionsQuery.refetch}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Executions</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <DataTable
              columns={columns}
              rows={executionsQuery.data?.items ?? []}
              emptyTitle="No official executions"
              emptyDescription="Validated analyses executed by an administrator will appear here."
            />
          </CardContent>
        </Card>
      )}

      <Modal
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        title={execution ? `${execution.instrument} · ${humanize(execution.side)}` : 'Execution detail'}
        size="lg"
      >
        {detailQuery.isLoading ? (
          <LoadingState label="Loading execution" />
        ) : detailQuery.isError ? (
          <ErrorState
            title="Execution unavailable"
            description={getErrorMessage(detailQuery.error)}
            onRetry={detailQuery.refetch}
          />
        ) : execution ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(execution.status)}>{humanize(execution.status)}</Badge>
              <Badge variant="outline">{humanize(execution.marketType)}</Badge>
              <Badge variant="outline">{humanize(execution.orderType)}</Badge>
              {execution.closureOutcome ? (
                <Badge variant={statusVariant(execution.closureOutcome)}>{humanize(execution.closureOutcome)}</Badge>
              ) : null}
            </div>

            {execution.errorMessage ? (
              <Alert variant="destructive" title="Execution message" description={execution.errorMessage} />
            ) : null}

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Exchange order:</span> {execution.exchangeOrderId || '—'}</p>
              <p><span className="text-muted-foreground">Client order:</span> {execution.clientOrderId || '—'}</p>
              <p><span className="text-muted-foreground">Requested:</span> {formatPrice(execution.requestedQuantity)}</p>
              <p><span className="text-muted-foreground">Filled:</span> {formatPrice(execution.filledQuantity)}</p>
              <p><span className="text-muted-foreground">Average fill:</span> {formatPrice(execution.averageFillPrice)}</p>
              <p><span className="text-muted-foreground">Fees:</span> {formatMoney(execution.fees)} {execution.feeAsset || ''}</p>
              <p><span className="text-muted-foreground">Submitted:</span> {formatDateTime(execution.submittedAt)}</p>
              <p><span className="text-muted-foreground">Last reconciled:</span> {formatDateTime(execution.lastReconciledAt)}</p>
              <p><span className="text-muted-foreground">Closed:</span> {formatDateTime(execution.closedAt)}</p>
              <p><span className="text-muted-foreground">Realized PnL:</span> {formatMoney(execution.realizedPnl)} {execution.pnlAsset || ''}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Fills</p>
              <DataTable
                columns={[
                  { key: 'executed_at', label: 'Executed', render: (row) => formatDateTime(row.executed_at) },
                  { key: 'quantity', label: 'Quantity', render: (row) => formatPrice(row.quantity) },
                  { key: 'price', label: 'Price', render: (row) => formatPrice(row.price) },
                  { key: 'fee_amount', label: 'Fee', render: (row) => `${formatMoney(row.fee_amount)} ${row.fee_asset || ''}` },
                  { key: 'exchange_trade_id', label: 'Exchange trade', render: (row) => row.exchange_trade_id || '—' },
                ]}
                rows={detail.fills ?? []}
                emptyTitle="No confirmed fills"
                emptyDescription="Only exchange-confirmed fills are recorded here."
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Trading order</p>
              <JsonViewer data={detail.order ?? { status: 'No trading order linked' }} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate(execution.id)}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={syncMutation.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Synchronize
              </Button>
              {execution.status === 'awaiting_confirmation' ? (
                <Button
                  onClick={() => {
                    setConfirmTarget(execution);
                    setConfirmOpen(true);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Confirm execution
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <ReasonDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm execution awaiting risk approval"
        description="Confirmation releases the deterministic risk approval for this official execution. It requires step-up verification and is fully audited."
        confirmLabel="Confirm execution"
        variant="destructive"
        isLoading={confirmMutation.isPending}
        onConfirm={(reason) => {
          const executionId = confirmTarget?.id;
          stepUp.requiresStepUp({
            reason: `Confirm official execution: ${reason}`,
            run: () => confirmMutation.mutateAsync({ executionId, reason }),
          });
        }}
      />

      <StepUpGate stepUp={stepUp} />
    </div>
  );
}
