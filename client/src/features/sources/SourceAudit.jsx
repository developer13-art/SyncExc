import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useQuery } from '@tanstack/react-query';
import { sourcesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export function SourceAudit({ sourceId }) {
  const auditQuery = useQuery({
    queryKey: queryKeys.sources.audit(sourceId, {}),
    queryFn: () => sourcesApi.getAudit(sourceId),
    enabled: Boolean(sourceId),
  });

  const events = auditQuery.data?.items ?? [];

  const columns = [
    {
      key: 'occurredAt',
      label: 'Time',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.occurredAt ? formatDateTime(row.occurredAt) : '—'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <span className="text-sm font-medium text-foreground">
          {row.action?.replace(/_/g, ' ') ?? '—'}
        </span>
      ),
    },
    {
      key: 'actorType',
      label: 'Actor',
      render: (row) => <Badge variant="muted">{row.actorType ?? 'user'}</Badge>,
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.reason ?? '—'}</span>
      ),
    },
    {
      key: 'result',
      label: 'Result',
      render: (row) => (
        <Badge variant={row.result === 'success' ? 'success' : 'warning'}>
          {row.result ?? 'recorded'}
        </Badge>
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <DataTable
          columns={columns}
          rows={events}
          isLoading={auditQuery.isLoading}
          emptyTitle="No audit history"
          emptyDescription="Audit events appear here as the source is managed."
        />
      </CardContent>
    </Card>
  );
}