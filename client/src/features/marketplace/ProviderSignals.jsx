import { useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useQuery } from '@tanstack/react-query';
import { marketplaceApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatDateTime, formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes.config.js';
import { getErrorMessage } from '../../api/errors.js';
import { SignalDiscussion } from './components/SignalDiscussion.jsx';

export function ProviderSignals({ providerId, onSubscribe }) {
  const [selectedSignalId, setSelectedSignalId] = useState(null);
  const signalsQuery = useQuery({
    queryKey: queryKeys.marketplace.providerSignals(providerId, {}),
    queryFn: () => marketplaceApi.listProviderSignals(providerId, { limit: 50 }),
    enabled: Boolean(providerId),
  });

  const signals = signalsQuery.data?.items ?? [];

  if (signalsQuery.isError) {
    return (
      <ErrorState
        title="Published signals are unavailable"
        description={getErrorMessage(signalsQuery.error)}
        onRetry={signalsQuery.refetch}
        action={signalsQuery.error?.code === 'SUBSCRIPTION_REQUIRED' && onSubscribe ? (
          <Button onClick={onSubscribe}>Subscribe to view signals</Button>
        ) : signalsQuery.error?.code === 'SUBSCRIPTION_REQUIRED' ? (
          <Button asChild>
            <Link to={ROUTES.app.marketplace.subscriptions}>View subscriptions</Link>
          </Button>
        ) : null}
      />
    );
  }

  const columns = [
    {
      key: 'entryTime',
      label: 'Entry time',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.entryTime ? formatDateTime(row.entryTime) : row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
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
      key: 'orderType',
      label: 'Order',
      render: (row) => (
        <Badge variant="muted">{row.orderType ?? 'market'}</Badge>
      ),
    },
    {
      key: 'entry',
      label: 'Entry',
      align: 'right',
      render: (row) => (
        <span>
          {row.entry
            ? formatQuantity(row.entry, 6)
            : row.entryRange
              ? `${formatQuantity(row.entryRange.min, 6)}–${formatQuantity(row.entryRange.max, 6)}`
              : '—'}
        </span>
      ),
    },
    {
      key: 'targets',
      label: 'Take profit',
      render: (row) => (
        <span>
          {row.targets?.length
            ? row.targets.map((target) => formatQuantity(target.price ?? target, 6)).join(', ')
            : '—'}
        </span>
      ),
    },
    {
      key: 'stopLoss',
      label: 'SL',
      align: 'right',
      render: (row) => (row.stopLoss ? formatQuantity(row.stopLoss, 6) : '—'),
    },
    {
      key: 'copyCount',
      label: 'Copies',
      align: 'right',
      render: (row) => row.copyCount ?? 0,
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
          onRowClick={(row) =>
            setSelectedSignalId((current) => current === row.id ? null : row.id)
          }
          isLoading={signalsQuery.isLoading}
          emptyTitle="No published signals"
          emptyDescription="This provider has no published signals yet."
        />
      </CardContent>
      {selectedSignalId ? (
        <div className="border-t border-border p-5">
          <SignalDiscussion signalId={selectedSignalId} />
        </div>
      ) : null}
    </Card>
  );
}