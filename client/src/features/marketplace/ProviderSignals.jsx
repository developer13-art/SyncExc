import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { useCopyConfigurations } from '../../hooks/useMarketplace.js';
import { useToast } from '../../hooks/useToast.js';

export function ProviderSignals({ providerId, onSubscribe }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedSignalId, setSelectedSignalId] = useState(null);
  const [copyTarget, setCopyTarget] = useState(null);
  const [selectedConfigurationId, setSelectedConfigurationId] = useState('');
  const signalsQuery = useQuery({
    queryKey: queryKeys.marketplace.providerSignals(providerId, {}),
    queryFn: () => marketplaceApi.listProviderSignals(providerId, { limit: 50 }),
    enabled: Boolean(providerId),
  });
  const {
    configurations,
    isLoading: configurationsLoading,
    error: configurationsError,
  } = useCopyConfigurations();
  const providerConfigurations = configurations.filter(
    (configuration) =>
      configuration.providerId === providerId &&
      configuration.status === 'active' &&
      configuration.executionMode !== 'monitor_only'
  );
  const existingProviderConfiguration = configurations.find(
    (configuration) =>
      configuration.providerId === providerId &&
      configuration.executionMode !== 'monitor_only'
  );
  const copySignal = useMutation({
    mutationFn: ({ signalId, configurationId }) =>
      marketplaceApi.copyPublishedSignal(signalId, configurationId),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.copySignalResults({}) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.providerSignals(providerId, {}) }),
      ]);
      const statuses = result.results?.map((item) => item.status) ?? [];
      if (statuses.includes('terminal_confirmation_required')) {
        toast.warning('Additional terminal risk approval is required', {
          description: 'Review and approve the exchange execution in Copy Results.',
        });
      } else if (statuses.includes('submitted')) {
        toast.success('Copy order submitted to the selected exchange account');
      } else if (statuses.includes('reconciliation_required')) {
        toast.error('The order outcome needs reconciliation', {
          description: 'Check Copy Results before attempting another order.',
        });
      } else if (statuses.every((status) => status === 'executed')) {
        toast.info('This signal was already copied');
      } else {
        const failure = result.results?.find((item) => item.status === 'rejected');
        toast.warning('The signal was not submitted', {
          description: failure?.errorMessage || failure?.skipReason?.replace(/_/g, ' ') ||
            'Review the reason in Copy Results.',
        });
      }
      setCopyTarget(null);
    },
    onError: (error) => {
      toast.error('Copy order failed', { description: getErrorMessage(error) });
    },
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
      key: 'copy',
      label: 'Copy',
      render: (row) => {
        if (configurationsLoading) {
          return <Button size="sm" variant="outline" disabled>Loading…</Button>;
        }
        if (configurationsError) {
          return <Button size="sm" variant="outline" disabled>Copy unavailable</Button>;
        }
        if (providerConfigurations.length === 0) {
          return (
            <Button size="sm" variant="outline" asChild>
              <Link
                to={existingProviderConfiguration
                  ? ROUTES.app.marketplace.copyConfiguration(existingProviderConfiguration.id)
                  : `${ROUTES.app.marketplace.createCopyConfiguration}?provider=${providerId}`}
                onClick={(event) => event.stopPropagation()}
              >
                <Copy className="h-3.5 w-3.5" />
                {existingProviderConfiguration ? 'Review copy setup' : 'Set up copy'}
              </Link>
            </Button>
          );
        }
        const selectedConfiguration = providerConfigurations.find(
          (configuration) => configuration.id === selectedConfigurationId
        ) || providerConfigurations[0];
        const configurationId = selectedConfiguration.id;
        return (
          <div className="flex min-w-40 items-center gap-2" onClick={(event) => event.stopPropagation()}>
            {providerConfigurations.length > 1 ? (
              <select
                className="h-8 min-w-28 rounded-md border border-input bg-background px-2 text-xs"
                value={configurationId}
                aria-label={`Copy configuration for ${row.instrument}`}
                onChange={(event) => setSelectedConfigurationId(event.target.value)}
              >
                {providerConfigurations.map((configuration) => (
                  <option key={configuration.id} value={configuration.id}>
                    {configuration.name || 'Copy setup'}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={copySignal.isPending}
              onClick={() => {
                setCopyTarget({
                  signal: row,
                  configuration: selectedConfiguration,
                });
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        );
      },
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
      {configurationsError ? (
        <p className="border-t border-border px-5 py-3 text-sm text-destructive" role="alert">
          Copy configurations could not be loaded: {getErrorMessage(configurationsError)}
        </p>
      ) : null}
      <ConfirmDialog
        open={Boolean(copyTarget)}
        onOpenChange={(open) => {
          if (!open && !copySignal.isPending) setCopyTarget(null);
        }}
        title={`Copy ${copyTarget?.signal.instrument ?? 'signal'}?`}
        description={
          copyTarget
            ? `This submits a ${copyTarget.signal.direction} ${copyTarget.signal.orderType ?? 'market'} order to the exchange account(s) configured in "${copyTarget.configuration?.name || 'your copy setup'}". Quantity comes from that setup. SyncExc risk checks still apply; an additional approval may be required.`
            : ''
        }
        confirmLabel="Submit copy order"
        onConfirm={async () => {
          try {
            await copySignal.mutateAsync({
              signalId: copyTarget.signal.id,
              configurationId: copyTarget.configuration.id,
            });
          } catch {
            // The mutation displays the failure through the toast.
          }
        }}
        isLoading={copySignal.isPending}
      />
    </Card>
  );
}