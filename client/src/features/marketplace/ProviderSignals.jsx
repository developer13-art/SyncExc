import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export function ProviderSignals({ providerId }) {
  const signalsQuery = useQuery({
    queryKey: queryKeys.marketplace.providerSignals(providerId, {}),
    queryFn: () => marketplaceApi.listProviderSignals(providerId, { limit: 50 }),
    enabled: Boolean(providerId),
  });

  const signals = signalsQuery.data?.items ?? [];

  const columns = [
    {
      key: 'occurredAt',
      label: 'Time',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.occurredAt ? formatRelativeTime(row.occurredAt) : '—'}
        </span>
      ),
    },
    {
      key: 'instrument',
      label: 'Instrument',
      render: (row) => <span className="font-medium text-foreground">{row.instrument}</span>,
    },
    {
      key: 'direction',
      label: 'Direction',
      render: (row) => (
        <span
          className={
            row.direction === 'long' || row.direction === 'buy'
              ? 'text-xs font-semibold uppercase text-success'
              : 'text-xs font-semibold uppercase text-destructive'
          }
        >
          {row.direction}
        </span>
      ),
    },
    {
      key: 'entry',
      label: 'Entry',
      align: 'right',
      render: (row) => (row.entry ? formatQuantity(row.entry, 6) : '—'),
    },
    {
      key: 'stopLoss',
      label: 'SL',
      align: 'right',
      render: (row) => (row.stopLoss ? formatQuantity(row.stopLoss, 6) : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'published' ? 'success' : 'muted'}>
          {row.status ?? 'published'}
        </Badge>
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <DataTable
          columns={columns}
          rows={signals}
          isLoading={signalsQuery.isLoading}
          emptyTitle="No published signals"
          emptyDescription="This provider has no published signals yet."
        />
      </CardContent>
    </Card>
  );
}