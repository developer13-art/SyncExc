import { useState } from 'react';
import { Eye, Play, RefreshCw } from 'lucide-react';
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
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { PageHeader } from './components/PageHeader.jsx';
import { ReasonDialog } from './components/ReasonDialog.jsx';
import { useOfficialTraderPage } from './hooks/useOfficialTraderPage.js';
import {
  formatConfidence,
  humanize,
  statusVariant,
} from './official-trader.utils.js';

export default function OfficialTraderResearch() {
  useOfficialTraderPage('AI research');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [runOpen, setRunOpen] = useState(false);
  const [detailRunId, setDetailRunId] = useState(null);

  const runsQuery = useQuery({
    queryKey: ['official-trader', 'research-runs', { limit: 100 }],
    queryFn: () => officialTraderApi.researchRuns({ limit: 100 }),
  });
  const detailQuery = useQuery({
    queryKey: ['official-trader', 'research-run', detailRunId],
    queryFn: () => officialTraderApi.researchRun(detailRunId),
    enabled: Boolean(detailRunId),
  });

  const runMutation = useMutation({
    mutationFn: ({ reason }) => officialTraderApi.runResearch({ reason }),
    onSuccess: (result) => {
      setRunOpen(false);
      if (result?.skipped) {
        toast.info('Research skipped', { description: result.reason });
      } else {
        toast.success('Research completed', {
          description: `${result?.analysesCreated ?? 0} analyses created, ${result?.rejected ?? 0} rejected.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['official-trader'] });
    },
    onError: (error) => toast.error('Research failed', { description: getErrorMessage(error) }),
  });

  const columns = [
    {
      key: 'started_at',
      label: 'Started',
      render: (row) => (
        <div>
          <p className="text-sm text-foreground">{formatDateTime(row.started_at)}</p>
          <p className="text-xs text-muted-foreground">
            Completed {row.completed_at ? formatDateTime(row.completed_at) : '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge>,
    },
    {
      key: 'candidates',
      label: 'Candidates',
      align: 'right',
      render: (row) => row.candidates_generated ?? 0,
    },
    {
      key: 'analyses',
      label: 'Analyses created',
      align: 'right',
      render: (row) => row.analyses_created ?? 0,
    },
    {
      key: 'rejected',
      label: 'Rejected',
      align: 'right',
      render: (row) => row.rejected ?? 0,
    },
    {
      key: 'model',
      label: 'AI model',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.ai_provider || '—'}{row.ai_model ? ` · ${row.ai_model}` : ''}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <IconButton label="View research run" onClick={() => setDetailRunId(row.id)}>
          <Eye className="h-4 w-4" />
        </IconButton>
      ),
    },
  ];

  const detail = detailQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI research"
        description="Research collects real market data and produces structured analyses. The AI can only propose trades: deterministic validation, risk checks, and administrator action remain mandatory before execution."
      >
        <IconButton
          label="Refresh research runs"
          onClick={() => runsQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw className={runsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
        <Button onClick={() => setRunOpen(true)}>
          <Play className="h-4 w-4" /> Run research now
        </Button>
      </PageHeader>

      <Alert
        variant="info"
        title="Research output is not performance"
        description="Generated analyses and research-only findings are excluded from live performance. Only exchange-reconciled closed trades count."
      />

      {runsQuery.isLoading ? (
        <LoadingState label="Loading research runs" />
      ) : runsQuery.isError ? (
        <ErrorState
          title="Research runs unavailable"
          description={getErrorMessage(runsQuery.error)}
          onRetry={runsQuery.refetch}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Research runs</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <DataTable
              columns={columns}
              rows={runsQuery.data?.items ?? []}
              emptyTitle="No research runs yet"
              emptyDescription="Run research manually or wait for the scheduled research job."
            />
          </CardContent>
        </Card>
      )}

      <ReasonDialog
        open={runOpen}
        onOpenChange={setRunOpen}
        title="Run official research"
        description="This fetches live market data and may spend AI credits. It never executes trades."
        confirmLabel="Run research"
        isLoading={runMutation.isPending}
        onConfirm={(reason) => runMutation.mutateAsync({ reason })}
      />

      <Modal
        open={Boolean(detailRunId)}
        onOpenChange={(open) => {
          if (!open) setDetailRunId(null);
        }}
        title="Research run detail"
        size="lg"
      >
        {detailQuery.isLoading ? (
          <LoadingState label="Loading research run" />
        ) : detailQuery.isError ? (
          <ErrorState
            title="Research run unavailable"
            description={getErrorMessage(detailQuery.error)}
            onRetry={detailQuery.refetch}
          />
        ) : detail ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={statusVariant(detail.run.status)}>{humanize(detail.run.status)}</Badge>
              <span className="text-muted-foreground">
                {formatDateTime(detail.run.started_at)} → {detail.run.completed_at ? formatDateTime(detail.run.completed_at) : 'in progress'}
              </span>
            </div>
            {detail.run.error_message ? (
              <Alert variant="destructive" title="Run error" description={detail.run.error_message} />
            ) : null}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
              <JsonViewer data={detail.run.summary ?? {}} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Analyses from this run
              </p>
              <DataTable
                columns={[
                  { key: 'instrument', label: 'Instrument' },
                  { key: 'direction', label: 'Direction', render: (row) => <Badge variant={row.direction === 'long' ? 'success' : 'destructive'}>{row.direction}</Badge> },
                  { key: 'strategyKey', label: 'Strategy', render: (row) => humanize(row.strategyKey) },
                  { key: 'confidence', label: 'Confidence', render: (row) => formatConfidence(row.confidence) },
                  { key: 'status', label: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{humanize(row.status)}</Badge> },
                ]}
                rows={detail.analyses ?? []}
                emptyTitle="No analyses from this run"
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
