import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useQuery } from '@tanstack/react-query';
import { synchronizationApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export function Reconciliation({ groupId }) {
  const unresolvedQuery = useQuery({
    queryKey: [...queryKeys.sync.unresolved({}), { groupId }],
    queryFn: () => synchronizationApi.listUnresolvedJobs({ groupId }),
    enabled: Boolean(groupId),
    refetchInterval: 30_000,
  });

  const items = unresolvedQuery.data?.items ?? [];

  const columns = [
    {
      key: 'detectedAt',
      label: 'Detected',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.detectedAt ? formatRelativeTime(row.detectedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'operationId',
      label: 'Operation',
      render: (row) => (
        <span className="font-mono text-xs text-foreground">
          {row.operationId?.slice(0, 12) ?? '—'}
        </span>
      ),
    },
    {
      key: 'destination',
      label: 'Destination',
      render: (row) => (
        <span className="text-xs text-foreground">{row.destinationLabel ?? '—'}</span>
      ),
    },
    {
      key: 'classification',
      label: 'Classification',
      render: (row) => (
        <Badge variant={classificationVariant(row.classification)}>
          {row.classification?.replace(/_/g, ' ') ?? 'unclassified'}
        </Badge>
      ),
    },
    {
      key: 'description',
      label: 'Details',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.description ?? '—'}</span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation discrepancies</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {unresolvedQuery.isLoading ? (
          <LoadingState label="Loading reconciliation data" />
        ) : items.length === 0 ? (
          <EmptyState
            title="No discrepancies"
            description="Reconciliation is currently clean for this group."
            size="sm"
            className="border-0 bg-transparent py-8"
          />
        ) : (
          <div className="p-5 pt-0">
            <DataTable columns={columns} rows={items} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function classificationVariant(classification) {
  if (!classification) {
    return 'muted';
  }
  if (classification.includes('unresolved')) {
    return 'destructive';
  }
  if (classification.includes('expected')) {
    return 'info';
  }
  return 'warning';
}