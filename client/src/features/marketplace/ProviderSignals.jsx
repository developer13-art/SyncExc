import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { connectionsApi, marketplaceApi, terminalApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import {
  findUsdConversionMarket,
  getUsdConversionRate,
} from '../../lib/trading/order-preview.js';
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
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';

const LATE_COPY_WARNING_MS = 15 * 60 * 1000;

export function ProviderSignals({ providerId, onSubscribe }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { activeWorkspaceId } = useWorkspaceContext();
  const [selectedSignalId, setSelectedSignalId] = useState(null);
  const [copyTarget, setCopyTarget] = useState(null);
  const [selectedConfigurationId, setSelectedConfigurationId] = useState('');
  const [selectedDestinationAccountIds, setSelectedDestinationAccountIds] = useState([]);
  const [copyAmount, setCopyAmount] = useState('');
  const signalsQuery = useQuery({
    queryKey: queryKeys.marketplace.providerSignals(providerId, {}),
    queryFn: () => marketplaceApi.listProviderSignals(providerId, { limit: 50 }),
    enabled: Boolean(providerId),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
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
  const selectedDestinations = useMemo(
    () =>
      availableCopyDestinations.filter(
        (destination) =>
          selectedDestinationAccountIds.includes(destination.account_id) &&
          destination.connection_status === 'active' &&
          destination.account_status === 'active',
      ),
    [availableCopyDestinations, selectedDestinationAccountIds],
  );
  const destinationExchangeCodes = useMemo(
    () => [...new Set(selectedDestinations.map((destination) => destination.exchange_code).filter(Boolean))],
    [selectedDestinations],
  );
  const destinationMarketsQueries = useQueries({
    queries: destinationExchangeCodes.map((exchangeCode) => ({
      queryKey: queryKeys.terminal.markets(activeWorkspaceId, { exchangeCode }),
      queryFn: () => terminalApi.listMarkets(activeWorkspaceId, { exchangeCode }),
      enabled: Boolean(activeWorkspaceId && copyTarget),
      staleTime: 60_000,
    })),
  });
  const destinationBalanceQueries = useQueries({
    queries: selectedDestinations.map((destination) => ({
      queryKey: queryKeys.connections.balances(destination.account_id),
      queryFn: () => connectionsApi.listBalances(destination.account_id),
      enabled: Boolean(copyTarget),
      staleTime: 15_000,
    })),
  });
  const destinationMarketDetails = selectedDestinations.map((destination, index) => {
    const exchangeIndex = destinationExchangeCodes.indexOf(destination.exchange_code);
    const marketsQuery = destinationMarketsQueries[exchangeIndex];
    const marketType = copyTarget?.signal?.marketType === 'spot' ? 'spot' : 'futures';
    const instrument = (marketsQuery?.data ?? []).find(
      (market) =>
        (market.exchangeSymbol === copyTarget?.signal?.instrument ||
          market.symbol === copyTarget?.signal?.instrument) &&
        (market.marketType === marketType ||
          (marketType === 'futures' && market.marketType === 'perpetual')),
    );
    const quoteAsset = instrument?.quoteAsset;
    const conversionMarket = findUsdConversionMarket(
      quoteAsset,
      marketsQuery?.data ?? [],
    );
    const balanceQuery = destinationBalanceQueries[index];
    const quoteBalance = balanceQuery?.data?.items?.find(
      (balance) =>
        String(balance.asset || '').toUpperCase() === String(quoteAsset || '').toUpperCase(),
    );
    const leverage = Math.max(1, Number(copyTarget?.signal?.leverage) || 1);
    const amount = Number(copyAmount);
    const isFutures = marketType === 'futures';
    const requiredBalance = Number.isFinite(amount) && amount > 0
      ? isFutures ? amount / leverage : amount
      : null;
    const availableBalance = Number(
      (isFutures ? balanceQuery?.data?.availableMargin : null) ??
        quoteBalance?.available ??
        quoteBalance?.free,
    );
    return {
      destination,
      marketsQuery,
      balanceQuery,
      instrument,
      quoteAsset,
      conversionMarket,
      isFutures,
      requiredBalance,
      availableBalance: Number.isFinite(availableBalance) ? availableBalance : null,
    };
  });
  const usdConversionRequests = useMemo(() => {
    const requests = new Map();
    for (const detail of destinationMarketDetails) {
      if (!detail.conversionMarket) continue;
      const symbol =
        detail.conversionMarket.instrument.exchangeSymbol ??
        detail.conversionMarket.instrument.symbol;
      const key = `${detail.destination.exchange_code}:${symbol}`;
      if (!requests.has(key)) {
        requests.set(key, {
          exchangeCode: detail.destination.exchange_code,
          symbol,
          asset: detail.quoteAsset,
        });
      }
    }
    return [...requests.values()];
  }, [destinationMarketDetails]);
  const usdConversionQueries = useQueries({
    queries: usdConversionRequests.map((request) => ({
      queryKey: queryKeys.terminal.marketData(activeWorkspaceId, {
        exchangeCode: request.exchangeCode,
        symbol: request.symbol,
        marketType: 'spot',
        timeframe: '1h',
        limit: 25,
      }),
      queryFn: () =>
        terminalApi.getMarketData(activeWorkspaceId, {
          exchangeCode: request.exchangeCode,
          symbol: request.symbol,
          marketType: 'spot',
          timeframe: '1h',
          limit: 25,
        }),
      enabled: Boolean(activeWorkspaceId && copyTarget),
      staleTime: 30_000,
      retry: false,
    })),
  });
  const totalEstimatedUsd = destinationMarketDetails.reduce((total, detail) => {
    const amount = Number(copyAmount);
    if (!Number.isFinite(amount) || amount <= 0) return total;
    const requestIndex = usdConversionRequests.findIndex(
      (request) =>
        request.exchangeCode === detail.destination.exchange_code &&
        request.asset === detail.quoteAsset,
    );
    const conversionQuery = usdConversionQueries[requestIndex];
    const rate = getUsdConversionRate(
      detail.quoteAsset,
      detail.conversionMarket,
      conversionQuery?.data?.overview?.lastPrice,
    );
    return rate ? total + amount * rate : total;
  }, 0);
  const hasCompleteUsdEstimate =
    destinationMarketDetails.length > 0 &&
    destinationMarketDetails.every((detail) => {
      const amount = Number(copyAmount);
      if (!Number.isFinite(amount) || amount <= 0) return false;
      if (!detail.conversionMarket) return Boolean(
        getUsdConversionRate(detail.quoteAsset, null, null),
      );
      const requestIndex = usdConversionRequests.findIndex(
        (request) =>
          request.exchangeCode === detail.destination.exchange_code &&
          request.asset === detail.quoteAsset,
      );
      return Number.isFinite(
        getUsdConversionRate(
          detail.quoteAsset,
          detail.conversionMarket,
          usdConversionQueries[requestIndex]?.data?.overview?.lastPrice,
        ),
      );
    });
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
      const successfulCount = statuses.filter((status) =>
        ['submitted', 'filled', 'partially_filled'].includes(status)
      ).length;
      const skippedResults = result.results?.filter((item) =>
        ['skipped', 'failed', 'reconciliation_required'].includes(item.status)
      ) ?? [];
      if (statuses.includes('terminal_confirmation_required')) {
        toast.warning('Additional terminal risk approval is required', {
          description: 'Review and approve the exchange execution in Copy Results.',
        });
      } else if (successfulCount > 0 && skippedResults.length > 0) {
        const firstSkip = skippedResults[0];
        toast.warning('Copy order submitted with skipped destinations', {
          description: `${successfulCount} orders accepted, ${skippedResults.length} skipped. ${
            firstSkip.errorMessage || firstSkip.skipReason?.replace(/_/g, ' ') || ''
          }`.trim(),
        });
      } else if (successfulCount > 0) {
        toast.success('Copy order accepted by the selected exchange account');
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

  return (
    <div className="space-y-4">
      {signalsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index}>
              <CardContent className="space-y-4 p-5 pt-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : signals.length === 0 ? (
        <EmptyState
          title="No published signals"
          description="This provider has no published signals yet."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {signals.map((signal) => {
            const arrivedAt = signal.createdAt || signal.entryTime;
            const ageMs = arrivedAt ? Date.now() - new Date(arrivedAt).getTime() : null;
            const hasExpired = signal.validUntil &&
              new Date(signal.validUntil).getTime() < Date.now();
            const isLate = Number.isFinite(ageMs) && ageMs >= LATE_COPY_WARNING_MS;
            const isActive = ['published', 'updated'].includes(signal.status);
            const isLong = ['long', 'buy'].includes(String(signal.direction).toLowerCase());
            const entry = signal.entry
              ? formatQuantity(signal.entry, 6)
              : signal.entryRange
                ? `${formatQuantity(signal.entryRange.min, 6)}–${formatQuantity(signal.entryRange.max, 6)}`
                : '—';
            const pnl = Number(signal.realizedPnl);
            const hasResult = signal.status === 'closed' &&
              signal.realizedPnl != null &&
              Number.isFinite(pnl);
            const selectedConfiguration = providerConfigurations.find(
              (configuration) => configuration.id === selectedConfigurationId,
            ) || providerConfigurations[0];

            return (
              <Card key={signal.id} className="flex min-w-0 flex-col">
                <CardContent className="flex h-full flex-col gap-4 p-5 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-base font-semibold text-foreground">
                        {signal.instrument}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={isLong ? 'success' : 'destructive'}>
                          {isLong ? 'Long' : 'Short'}
                        </Badge>
                        <Badge variant="muted">
                          {signal.marketType || 'market'} · {signal.orderType || 'market'}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant={isActive ? 'success' : 'muted'}>
                      {signal.status === 'closed' ? 'Closed' : signal.status || 'published'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Signal arrived</p>
                      <p
                        className="mt-1 truncate text-sm font-medium text-foreground"
                        title={arrivedAt ? formatDateTime(arrivedAt) : undefined}
                      >
                        {arrivedAt ? formatRelativeTime(arrivedAt) : 'Time unavailable'}
                      </p>
                      {arrivedAt ? (
                        <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                          {formatDateTime(arrivedAt)}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total copies</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {Number(signal.copyCount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Signal entry</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{entry}</p>
                    </div>
                    {hasResult ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Closed result</p>
                        <p
                          className={`mt-1 text-sm font-medium ${
                            pnl > 0
                              ? 'text-success'
                              : pnl < 0
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                          }`}
                          title={signal.closedAt ? `Closed ${formatDateTime(signal.closedAt)}` : undefined}
                        >
                          {pnl > 0 ? 'Profit' : pnl < 0 ? 'Loss' : 'Breakeven'}:{' '}
                          {formatQuantity(signal.realizedPnl, 6)} {signal.pnlAsset || ''}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <p
                    className={`rounded-md border px-3 py-2 text-xs ${
                      signal.status === 'closed' || hasExpired || isLate
                        ? 'border-warning/30 bg-warning/5 text-warning'
                        : 'border-border bg-muted/20 text-muted-foreground'
                    }`}
                  >
                    {signal.status === 'closed'
                      ? 'This signal is closed and can no longer be copied.'
                      : hasExpired
                        ? 'This signal has passed its validity time; it may be too late to copy.'
                        : isLate
                          ? `This signal arrived ${formatRelativeTime(arrivedAt)}. It may be too late to copy at the original entry; check the current market price before submitting.`
                          : 'Review the current market price before copying; your fill may differ from the signal entry.'}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedSignalId((current) =>
                        current === signal.id ? null : signal.id
                      )}
                    >
                      {selectedSignalId === signal.id ? 'Hide discussion' : 'Discussion'}
                    </Button>
                    {!isActive ? (
                      <Button size="sm" variant="outline" disabled>
                        <Copy className="h-3.5 w-3.5" />
                        {signal.status === 'closed' ? 'Closed' : 'Unavailable'}
                      </Button>
                    ) : configurationsLoading ? (
                      <Button size="sm" variant="outline" disabled>Loading copy setup…</Button>
                    ) : configurationsError ? (
                      <Button size="sm" variant="outline" disabled>Copy unavailable</Button>
                    ) : providerConfigurations.length === 0 ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          to={existingProviderConfiguration
                            ? ROUTES.app.marketplace.copyConfiguration(existingProviderConfiguration.id)
                            : `${ROUTES.app.marketplace.createCopyConfiguration}?provider=${providerId}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {existingProviderConfiguration ? 'Review copy setup' : 'Set up copy'}
                        </Link>
                      </Button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {providerConfigurations.length > 1 ? (
                          <select
                            className="h-8 max-w-36 rounded-md border border-input bg-background px-2 text-xs"
                            value={selectedConfiguration.id}
                            aria-label={`Copy configuration for ${signal.instrument}`}
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
                          disabled={copySignal.isPending}
                          onClick={() => setCopyTarget({
                            signal,
                            configuration: selectedConfiguration,
                          })}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {selectedSignalId ? (
        <Card>
          <CardContent className="p-5 pt-5">
          <SignalDiscussion signalId={selectedSignalId} />
          </CardContent>
        </Card>
      ) : null}
      {configurationsError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
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
          <p className="rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
            Your selected copy setup applies its stop-loss and take-profit rules automatically.
            You only enter the investment amount for this copy; blank protection overrides use
            the provider signal&apos;s values.
          </p>
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
                {selectedDestinations.length > 0 &&
                Number.isFinite(Number(copyAmount)) &&
                Number(copyAmount) > 0 ? (
                  <div className="grid gap-2 rounded-md border border-border p-3">
                    <p className="text-xs font-medium text-foreground">
                      Per-account funding check
                    </p>
                    {destinationMarketDetails.map((detail) => {
                      const amount = Number(copyAmount);
                      const balanceFreshness = detail.isFutures
                        ? detail.balanceQuery?.data?.accountSnapshotFreshness ?? 'unknown'
                        : detail.balanceQuery?.data?.freshness ?? 'unknown';
                      const hasBalanceSnapshot = ['current', 'stale'].includes(balanceFreshness);
                      const isUnsupportedSpotShort =
                        !detail.isFutures &&
                        ['short', 'sell'].includes(
                          String(copyTarget.signal.direction || '').toLowerCase(),
                        );
                      const isLoading =
                        detail.marketsQuery?.isLoading || detail.balanceQuery?.isLoading;
                      const balanceIsSufficient =
                        hasBalanceSnapshot &&
                        detail.requiredBalance !== null &&
                        detail.availableBalance !== null &&
                        detail.availableBalance >= detail.requiredBalance;
                      const balanceIsInsufficient =
                        hasBalanceSnapshot &&
                        detail.requiredBalance !== null &&
                        (detail.availableBalance ?? 0) < detail.requiredBalance;
                      const conversionRequestIndex = usdConversionRequests.findIndex(
                        (request) =>
                          request.exchangeCode === detail.destination.exchange_code &&
                          request.asset === detail.quoteAsset,
                      );
                      const usdRate = getUsdConversionRate(
                        detail.quoteAsset,
                        detail.conversionMarket,
                        usdConversionQueries[conversionRequestIndex]?.data?.overview?.lastPrice,
                      );
                      let statusText = 'Balance not available; live check required';
                      let statusVariant = 'muted';
                      if (isLoading) {
                        statusText = 'Checking pair and balance…';
                      } else if (detail.marketsQuery?.isError || detail.balanceQuery?.isError) {
                        statusText = 'Could not load preview; live check required';
                        statusVariant = 'warning';
                      } else if (isUnsupportedSpotShort) {
                        statusText = 'Spot accounts cannot open short positions';
                        statusVariant = 'destructive';
                      } else if (detail.marketsQuery?.data && !detail.instrument) {
                        statusText = 'Instrument is not supported on this exchange';
                        statusVariant = 'destructive';
                      } else if (balanceIsInsufficient) {
                        statusText = `Insufficient on last sync · ${formatQuantity(
                          detail.availableBalance ?? 0,
                          6,
                        )} ${detail.quoteAsset} available`;
                        statusVariant = 'destructive';
                      } else if (balanceIsSufficient) {
                        statusText = `${balanceFreshness === 'stale' ? 'Enough on stale snapshot' : 'Sufficient'} · ${formatQuantity(
                          detail.availableBalance,
                          6,
                        )} ${detail.quoteAsset} available`;
                        statusVariant = balanceFreshness === 'stale' ? 'warning' : 'success';
                      }
                      return (
                        <div
                          key={detail.destination.account_id}
                          className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {(detail.destination.exchange_code || 'Exchange').toUpperCase()}
                              {detail.destination.account_type
                                ? ` · ${detail.destination.account_type}`
                                : ''}
                            </p>
                            <p className="text-muted-foreground">
                              Per account: {detail.quoteAsset
                                ? formatCurrency(amount, detail.quoteAsset)
                                : formatQuantity(amount, 4)}
                              {usdRate
                                ? ` · ${['USDT', 'USDC'].includes(
                                    String(detail.quoteAsset).toUpperCase(),
                                  ) ? '≈ ' : ''}${formatCurrency(amount * usdRate, 'USD')} USD`
                                : ''}
                              {detail.isFutures
                                ? ` · est. margin ${formatQuantity(
                                    detail.requiredBalance,
                                    4,
                                  )} ${detail.quoteAsset}`
                                : ''}
                            </p>
                          </div>
                          <Badge variant={statusVariant}>{statusText}</Badge>
                        </div>
                      );
                    })}
                    <div className="border-t border-border pt-2 text-xs">
                      <span className="text-muted-foreground">
                        Estimated total across selected accounts:{' '}
                      </span>
                      <span className="font-semibold text-foreground">
                        {hasCompleteUsdEstimate
                          ? `${destinationMarketDetails.some((detail) =>
                              ['USDT', 'USDC'].includes(
                                String(detail.quoteAsset || '').toUpperCase(),
                              ),
                            ) ? '≈ ' : ''}${formatCurrency(totalEstimatedUsd, 'USD')} USD`
                          : 'USD estimate unavailable for one or more quote assets'}
                      </span>
                    </div>
                    <p className="text-2xs text-muted-foreground">
                      Estimates use the latest synced balances and market conversion rates. The
                      exchange and risk checks verify funds, pair support, and permissions again
                      before each order is sent.
                    </p>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  This amount and your account selection are private. Each selected destination
                  uses the same amount in that pair’s quote currency.
                </p>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
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