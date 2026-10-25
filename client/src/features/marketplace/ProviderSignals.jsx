import { useEffect, useState } from 'react';
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
import { useCopyConfigurations } from '../../hooks/useMarketplace.js';
import { useToast } from '../../hooks/useToast.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';

export function ProviderSignals({ providerId, onSubscribe }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedSignalId, setSelectedSignalId] = useState(null);
  const [copyTarget, setCopyTarget] = useState(null);
  const [selectedConfigurationId, setSelectedConfigurationId] = useState('');
  const [selectedDestinationAccountIds, setSelectedDestinationAccountIds] = useState([]);
  const [copyAmount, setCopyAmount] = useState('');
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
  const copyConfigurationDetailQuery = useQuery({
    queryKey: queryKeys.marketplace.copyConfiguration(copyTarget?.configuration?.id),
    queryFn: () => marketplaceApi.getCopyConfiguration(copyTarget.configuration.id),
    enabled: Boolean(copyTarget?.configuration?.id),
  });
  const availableCopyDestinations = copyConfigurationDetailQuery.data?.destinations ?? [];
  const availableDestinationKey = availableCopyDestinations
    .filter((item) =>
      item.connection_status === 'active' && item.account_status === 'active'
    )
    .map((item) => item.account_id)
    .join('|');
  useEffect(() => {
    setSelectedDestinationAccountIds(availableDestinationKey ? availableDestinationKey.split('|') : []);
  }, [copyTarget?.configuration?.id, availableDestinationKey]);
  useEffect(() => {
    setCopyAmount('');
  }, [copyTarget?.signal?.id]);
  const copySignal = useMutation({
    mutationFn: ({ signalId, configurationId, destinationAccountIds, amount }) =>
      marketplaceApi.copyPublishedSignal(signalId, {
        configurationId,
        destinationAccountIds,
        amount,
      }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.copySignalResults({}) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.providerSignals(providerId, {}) }),
      ]);
      const statuses = result.results?.map((item) => item.status) ?? [];
      const submittedCount = statuses.filter((status) => status === 'submitted').length;
      const skippedResults = result.results?.filter((item) =>
        ['skipped', 'failed', 'reconciliation_required'].includes(item.status)
      ) ?? [];
      if (statuses.includes('terminal_confirmation_required')) {
        toast.warning('Additional terminal risk approval is required', {
          description: 'Review and approve the exchange execution in Copy Results.',
        });
      } else if (submittedCount > 0 && skippedResults.length > 0) {
        const firstSkip = skippedResults[0];
        toast.warning('Copy order submitted with skipped destinations', {
          description: `${submittedCount} submitted, ${skippedResults.length} skipped. ${
            firstSkip.errorMessage || firstSkip.skipReason?.replace(/_/g, ' ') || ''
          }`.trim(),
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
        const failure = result.results?.find((item) =>
          ['rejected', 'skipped', 'failed'].includes(item.status)
        );
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
      <Modal
        open={Boolean(copyTarget)}
        onOpenChange={(open) => {
          if (!open && !copySignal.isPending) setCopyTarget(null);
        }}
        title={`Copy ${copyTarget?.signal.instrument ?? 'signal'}?`}
        description="Choose one or more authorized destination accounts and enter the quote-currency amount to invest on each."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={copySignal.isPending}
              onClick={() => setCopyTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                copySignal.isPending ||
                copyConfigurationDetailQuery.isLoading ||
                copyConfigurationDetailQuery.isError ||
                selectedDestinationAccountIds.length === 0 ||
                !Number.isFinite(Number(copyAmount)) ||
                Number(copyAmount) <= 0
              }
              onClick={submitCopyTrade}
            >
              {copySignal.isPending ? 'Submitting…' : 'Submit copy order'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {copyConfigurationDetailQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading authorized destination accounts…</p>
          ) : copyConfigurationDetailQuery.isError ? (
            <p className="text-sm text-destructive" role="alert">
              Could not load destination accounts: {getErrorMessage(copyConfigurationDetailQuery.error)}
            </p>
          ) : (
            <>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Destination accounts</legend>
                {availableCopyDestinations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No accounts are authorized in this copy configuration.</p>
                ) : (
                  <div className="grid gap-2 rounded-md border border-border p-3">
                    {availableCopyDestinations.map((destination) => {
                      const accountId = destination.account_id;
                      const isActive = destination.connection_status === 'active' &&
                        destination.account_status === 'active';
                      return (
                        <label key={destination.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedDestinationAccountIds.includes(accountId)}
                            disabled={!isActive || copySignal.isPending}
                            onChange={(event) => setSelectedDestinationAccountIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, accountId])]
                                : current.filter((id) => id !== accountId)
                            )}
                          />
                          <span>
                            {(destination.exchange_code || 'Exchange').toUpperCase()}
                            {destination.account_type ? ` · ${destination.account_type}` : ''}
                            {!isActive ? ` · unavailable (${destination.connection_status}/${destination.account_status})` : ''}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
              <div className="grid gap-2">
                <label htmlFor="copy-trade-amount" className="text-sm font-medium">
                  Investment per account (quote currency)
                </label>
                <Input
                  id="copy-trade-amount"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={copyAmount}
                  onChange={(event) => setCopyAmount(event.target.value)}
                  placeholder="Enter amount"
                />
                <p className="text-xs text-muted-foreground">
                  This amount and your account selection are private. Each destination is checked for pair support, account health, and available balance before submission. Risk controls and any required approval still apply.
                </p>
              </div>
            </>
          )}
        </div>
      </Modal>
    </Card>
  );

  async function submitCopyTrade() {
    if (!copyTarget) return;
    try {
      await copySignal.mutateAsync({
        signalId: copyTarget.signal.id,
        configurationId: copyTarget.configuration.id,
        destinationAccountIds: selectedDestinationAccountIds,
        amount: copyAmount,
      });
    } catch {
      // The mutation displays the failure through the toast.
    }
  }
}