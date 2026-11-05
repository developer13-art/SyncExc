import { useState } from 'react';
import { ClipboardCheck, Eye, Play, RefreshCw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Input } from '../../components/ui/Input.jsx';
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
  formatConfidence,
  formatList,
  formatPercentValue,
  formatPrice,
  humanize,
  statusVariant,
} from './official-trader.utils.js';

const STATUSES = [
  '', 'generated', 'validated', 'rejected', 'execution_pending', 'executed',
  'partially_executed', 'published', 'expired', 'research_only', 'failed',
];

export default function AnalysisManagement() {
  useOfficialTraderPage('Analysis management');
  const toast = useToast();
  const queryClient = useQueryClient();
  const stepUp = useStepUpAuth();

  const [filters, setFilters] = useState({ status: '', marketType: '', instrument: '' });
  const [detailId, setDetailId] = useState(null);
  const [validateOpen, setValidateOpen] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionAnalysis, setActionAnalysis] = useState(null);

  const analysesQuery = useQuery({
    queryKey: ['official-trader', 'analyses', filters],
    queryFn: () => officialTraderApi.analyses({
      status: filters.status || undefined,
      marketType: filters.marketType || undefined,
      instrument: filters.instrument.trim() || undefined,
      limit: 100,
    }),
  });
  const detailQuery = useQuery({
    queryKey: ['official-trader', 'analysis', detailId],
    queryFn: () => officialTraderApi.analysis(detailId),
    enabled: Boolean(detailId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['official-trader'] });

  const validateMutation = useMutation({
    mutationFn: ({ analysisId, reason }) =>
      officialTraderApi.validateAnalysis(analysisId, { reason }),
    onSuccess: (result) => {
      setValidateOpen(false);
      toast.success('Analysis validated', {
        description: result?.status ? `New status: ${humanize(result.status)}.` : undefined,
      });
      invalidate();
    },
    onError: (error) => toast.error('Validation failed', { description: getErrorMessage(error) }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ reason }) => officialTraderApi.validatePending({ limit: 10, reason }),
    onSuccess: (result) => {
      setBulkOpen(false);
      toast.success('Pending analyses processed', {
        description: `${result?.validated ?? 0} attempt(s).`,
      });
      invalidate();
    },
    onError: (error) => toast.error('Validation failed', { description: getErrorMessage(error) }),
  });

  const executeMutation = useMutation({
    mutationFn: ({ analysisId, reason }) =>
      officialTraderApi.executeAnalysis(analysisId, { reason }),
    onSuccess: (result) => {
      setExecuteOpen(false);
      toast.success('Execution prepared', {
        description: result?.status
          ? `Execution status: ${humanize(result.status)}.`
          : 'Execution submitted to the deterministic order path.',
      });
      invalidate();
    },
    onError: (error) => toast.error('Execution failed', { description: getErrorMessage(error) }),
  });

  const rows = analysesQuery.data?.items ?? [];

  const columns = [
    {
      key: 'created_at',
      label: 'Created',
      render: (row) => (
        <div>
          <p className="text-sm text-foreground">{formatDateTime(row.created_at)}</p>
          <p className="text-xs text-muted-foreground">{row.exchange_code} · {row.timeframe}</p>
        </div>
      ),
    },
    {
      key: 'instrument',
      label: 'Setup',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-foreground">{row.instrument}</p>
          <p className="text-xs text-muted-foreground">
            {humanize(row.market_type)} · {humanize(row.strategy_key)} · {humanize(row.order_type)}
          </p>
        </div>
      ),
    },
    {
      key: 'direction',
      label: 'Direction',
      render: (row) => (
        <Badge variant={row.direction === 'long' ? 'success' : 'destructive'}>
          {humanize(row.direction)}
        </Badge>
      ),
    },
    {
      key: 'levels',
      label: 'Levels',
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          <p>Entry {formatPrice(row.entry_price)}</p>
          <p>SL {formatPrice(row.stop_loss)} · TP {formatPrice((row.targets ?? [])[0])}</p>
        </div>
      ),
    },
    {
      key: 'confidence',
      label: 'Confidence',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <p className="text-sm">{formatConfidence(row.confidence)}</p>
          <p className="text-xs text-muted-foreground">R:R {formatPrice(row.risk_reward)} · {formatPercentValue(row.risk_percentage)} risk</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge>
          {row.published_signal_id ? <Badge variant="info">Published</Badge> : null}
          {row.rejection_reason ? (
            <span className="max-w-[180px] text-xs text-destructive">{row.rejection_reason}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <IconButton label="View analysis" onClick={() => setDetailId(row.id)}>
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Validate analysis"
            onClick={() => {
              setActionAnalysis(row);
              setValidateOpen(true);
            }}
          >
            <ClipboardCheck className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Execute analysis"
            onClick={() => {
              setActionAnalysis(row);
              setExecuteOpen(true);
            }}
          >
            <Play className="h-4 w-4" />
          </IconButton>
        </div>
      ),
    },
  ];

  const detail = detailQuery.data;
  const analysis = detail?.analysis;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analysis management"
        description="Every analysis must pass deterministic validation and risk checks before execution. AI output can never bypass validation, and failed or unfilled analyses never become published trades."
      >
        <IconButton label="Refresh analyses" onClick={() => analysesQuery.refetch()} className="border border-border">
          <RefreshCw className={analysesQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <ClipboardCheck className="h-4 w-4" /> Validate pending
        </Button>
      </PageHeader>

      <div className="grid gap-2 sm:grid-cols-3">
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
        <label className="grid gap-1 text-sm font-medium">
          Instrument
          <Input
            value={filters.instrument}
            onChange={(event) => setFilters((current) => ({ ...current, instrument: event.target.value }))}
            placeholder="Filter by instrument"
          />
        </label>
      </div>

      {analysesQuery.isLoading ? (
        <LoadingState label="Loading analyses" />
      ) : analysesQuery.isError ? (
        <ErrorState
          title="Analyses unavailable"
          description={getErrorMessage(analysesQuery.error)}
          onRetry={analysesQuery.refetch}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Analyses</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <DataTable
              columns={columns}
              rows={rows}
              emptyTitle="No analyses"
              emptyDescription="Research-generated analyses will appear here."
            />
          </CardContent>
        </Card>
      )}

      <Modal
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        title={analysis ? `${analysis.instrument} · ${humanize(analysis.direction)}` : 'Analysis detail'}
        size="lg"
      >
        {detailQuery.isLoading ? (
          <LoadingState label="Loading analysis" />
        ) : detailQuery.isError ? (
          <ErrorState
            title="Analysis unavailable"
            description={getErrorMessage(detailQuery.error)}
            onRetry={detailQuery.refetch}
          />
        ) : analysis ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(analysis.status)}>{humanize(analysis.status)}</Badge>
              <Badge variant="outline">{humanize(analysis.marketType)}</Badge>
              <Badge variant="outline">{humanize(analysis.strategyKey)}</Badge>
              <Badge variant="outline">{humanize(analysis.orderType)}</Badge>
              <Badge variant="outline">{formatConfidence(analysis.confidence)} confidence</Badge>
            </div>

            {analysis.rejectionReason ? (
              <Alert variant="destructive" title="Rejected" description={analysis.rejectionReason} />
            ) : null}

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Entry:</span> {formatPrice(analysis.entryPrice)}</p>
              <p><span className="text-muted-foreground">Stop-loss:</span> {formatPrice(analysis.stopLoss)}</p>
              <p><span className="text-muted-foreground">Targets:</span> {formatList(analysis.targets)}</p>
              <p><span className="text-muted-foreground">Risk reward:</span> {formatPrice(analysis.riskReward)}</p>
              <p><span className="text-muted-foreground">Position size:</span> {formatPrice(analysis.positionSize)}</p>
              <p><span className="text-muted-foreground">Risk:</span> {formatPercentValue(analysis.riskPercentage)}</p>
              <p><span className="text-muted-foreground">Expires:</span> {formatDateTime(analysis.expiresAt)}</p>
              <p><span className="text-muted-foreground">Validated:</span> {formatDateTime(analysis.validatedAt)}</p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reasoning</p>
              <p className="text-sm text-foreground">{analysis.reasoning || '—'}</p>
              {analysis.invalidationCondition ? (
                <p className="mt-1 text-xs text-muted-foreground">{analysis.invalidationCondition}</p>
              ) : null}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Indicators</p>
              <JsonViewer data={analysis.indicators ?? {}} />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Executions</p>
              <DataTable
                columns={[
                  { key: 'execution_number', label: '#', render: (row) => row.execution_number ?? '—' },
                  { key: 'side', label: 'Side', render: (row) => humanize(row.side) },
                  { key: 'status', label: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge> },
                  { key: 'filled_quantity', label: 'Filled', render: (row) => formatPrice(row.filled_quantity) },
                  { key: 'average_fill_price', label: 'Avg fill', render: (row) => formatPrice(row.average_fill_price) },
                ]}
                rows={detail.executions ?? []}
                emptyTitle="No executions"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActionAnalysis({ id: analysis.id, instrument: analysis.instrument });
                  setValidateOpen(true);
                }}
              >
                <ClipboardCheck className="h-4 w-4" /> Re-validate
              </Button>
              <Button
                onClick={() => {
                  setActionAnalysis({ id: analysis.id, instrument: analysis.instrument });
                  setExecuteOpen(true);
                }}
              >
                <Play className="h-4 w-4" /> Execute
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ReasonDialog
        open={validateOpen}
        onOpenChange={setValidateOpen}
        title="Validate analysis"
        description="Runs deterministic checks and risk evaluation. Validation never executes a trade and cannot be bypassed by AI output."
        confirmLabel="Validate"
        isLoading={validateMutation.isPending}
        onConfirm={(reason) =>
          validateMutation.mutateAsync({ analysisId: actionAnalysis?.id, reason })
        }
      />

      <ReasonDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Validate pending analyses"
        description="Validates up to ten pending analyses with deterministic checks and risk evaluation."
        confirmLabel="Validate pending"
        isLoading={bulkMutation.isPending}
        onConfirm={(reason) => bulkMutation.mutateAsync({ reason })}
      />

      <ReasonDialog
        open={executeOpen}
        onOpenChange={setExecuteOpen}
        title="Execute analysis"
        description="Execution requires a validated analysis, an assigned exchange account, passing risk checks, and no active emergency pause. This action requires step-up verification."
        confirmLabel="Execute analysis"
        variant="destructive"
        isLoading={executeMutation.isPending}
        onConfirm={(reason) => {
          const analysisId = actionAnalysis?.id;
          stepUp.requiresStepUp({
            reason: `Execute official analysis ${actionAnalysis?.instrument ?? ''}: ${reason}`,
            run: () => executeMutation.mutateAsync({ analysisId, reason }),
          });
        }}
      />

      <StepUpGate stepUp={stepUp} />
    </div>
  );
}
