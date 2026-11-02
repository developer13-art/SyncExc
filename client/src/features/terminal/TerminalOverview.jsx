import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import {
  getInstrumentValue,
  InstrumentSelector,
} from './components/InstrumentSelector.jsx';
import { OrderForm } from './components/OrderForm.jsx';
import { OrderConfirmationModal } from './components/OrderConfirmationModal.jsx';
import { PriceChart } from './components/PriceChart.jsx';
import { OrderBook } from './components/OrderBook.jsx';
import { RecentTrades } from './components/RecentTrades.jsx';
import { OpenOrders } from './OpenOrders.jsx';
import { Positions } from './Positions.jsx';
import { TradeHistory } from './TradeHistory.jsx';
import { ExecutionStatus } from './ExecutionStatus.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import {
  useTerminalMarkets,
  useTerminalMarketData,
  useTerminalOrders,
} from '../../hooks/useTerminal.js';
import { useConnections, useExchangeRegistry } from '../../hooks/useConnections.js';
import { connectionsApi, identityApi, terminalApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';
import { userPreferencesQueryKey } from '../settings/useUserPreferences.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import {
  findCompatibleInstrument,
  normalizeMarketType,
} from './market-matching.util.js';
import {
  calculateOrderPreview,
  findUsdConversionMarket,
  getUsdConversionRate,
} from '../../lib/trading/order-preview.js';

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
const EXCHANGE_TIMEFRAMES = {
  bitget: TIMEFRAMES.filter((option) => option !== '1M'),
};

function formatMarketValue(value, maximumFractionDigits = 6) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits });
}

function findAvailableBalance(balances, asset) {
  return balances.find(
    (balance) => String(balance.asset).toUpperCase() === String(asset || '').toUpperCase(),
  )?.available;
}

export default function TerminalOverview() {
  const dispatch = useDispatch();
  const toast = useToast();
  const {
    activeWorkspaceId,
    isLoading: isWorkspaceLoading,
  } = useWorkspaceContext();

  const preferencesQuery = useQuery({
    queryKey: userPreferencesQueryKey,
    queryFn: () => identityApi.getPreferences(),
  });
  const connectionsQuery = useConnections({ status: 'active' });
  const exchangeRegistryQuery = useExchangeRegistry();

  const [chartExchangeCode, setChartExchangeCode] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [indicators, setIndicators] = useState(['sma20']);
  const [levels, setLevels] = useState([]);
  const [levelInput, setLevelInput] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);
  const [destinationAccountId, setDestinationAccountId] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approvalRequestId, setApprovalRequestId] = useState(null);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const tradingPreferences = preferencesQuery.data?.trading;

  useEffect(() => {
    const preferredTimeframe = tradingPreferences?.defaultChartTimeframe;
    if (TIMEFRAMES.includes(preferredTimeframe)) setTimeframe(preferredTimeframe);
  }, [tradingPreferences?.defaultChartTimeframe]);

  useEffect(() => {
    const availableTimeframes = EXCHANGE_TIMEFRAMES[chartExchangeCode] ?? TIMEFRAMES;
    if (!availableTimeframes.includes(timeframe)) setTimeframe('1d');
  }, [chartExchangeCode, timeframe]);

  const connections = connectionsQuery.data?.items ?? [];

  const accounts = useMemo(
    () =>
      connections.flatMap((c) =>
        (c.accounts ?? []).map((a) => ({
          ...a,
          label: [c.exchangeName ?? c.exchange, c.label, c.environment, a.accountType ?? a.type]
            .filter(Boolean)
            .join(' · '),
          type: a.type ?? a.accountType,
          connectionId: c.id,
          exchangeName: c.exchangeName,
          exchange: c.exchange,
          environment: c.environment,
          healthStatus:
            c.status === 'degraded' ? 'degraded' : c.health?.status ?? c.status,
        })),
      ),
    [connections],
  );

  useEffect(() => {
    const exchanges = exchangeRegistryQuery.exchanges;
    if (!exchanges.length) return;
    setChartExchangeCode((current) =>
      exchanges.some((exchange) => exchange.id === current) ? current : exchanges[0].id,
    );
  }, [exchangeRegistryQuery.exchanges]);

  useEffect(() => {
    if (
      destinationAccountId &&
      !accounts.some(
        (account) => account.id === destinationAccountId && account.status === 'active',
      )
    ) {
      setDestinationAccountId(null);
    }
  }, [accounts, destinationAccountId]);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Trading Terminal'));
    dispatch(uiActions.setBreadcrumbs([{ label: 'Terminal', path: '/app/terminal' }]));
  }, [dispatch]);

  const chartExchange = exchangeRegistryQuery.exchanges.find(
    (exchange) => exchange.id === chartExchangeCode,
  );
  const destinationAccounts = accounts.filter((account) => account.status === 'active');
  const destinationAccount = destinationAccounts.find(
    (account) => account.id === destinationAccountId,
  );
  const destinationConnection = connections.find(
    (connection) => connection.id === destinationAccount?.connectionId,
  );

  const marketsQuery = useTerminalMarkets(activeWorkspaceId, {
    exchangeCode: chartExchangeCode,
  });
  const destinationMarketsQuery = useTerminalMarkets(activeWorkspaceId, {
    exchangeCode: destinationConnection?.exchange,
  });
  const destinationBalancesQuery = useQuery({
    queryKey: queryKeys.connections.balances(destinationAccountId ?? 'no-destination'),
    queryFn: () => connectionsApi.listBalances(destinationAccountId),
    enabled: Boolean(confirmOpen && activeWorkspaceId && destinationAccountId),
    staleTime: 15_000,
  });

  const ordersQuery = useTerminalOrders(activeWorkspaceId, { status: 'open' });

  const instruments = marketsQuery.data ?? [];
  const destinationInstruments = destinationMarketsQuery.data ?? [];

  useEffect(() => {
    if (!instruments.length) {
      setSelectedInstrument(null);
      return;
    }
    const preferredMarketType = tradingPreferences?.defaultMarketType ?? 'spot';
    const currentSymbol = selectedInstrument?.exchangeSymbol ?? selectedInstrument?.symbol;
    if (currentSymbol && instruments.some((item) =>
      (item.exchangeSymbol ?? item.symbol) === currentSymbol &&
      normalizeMarketType(item.marketType) === normalizeMarketType(selectedInstrument?.marketType)
    )) return;
    setSelectedInstrument(
      instruments.find(
        (item) => normalizeMarketType(item.marketType) === normalizeMarketType(preferredMarketType),
      ) ?? instruments[0],
    );
  }, [instruments, selectedInstrument, tradingPreferences?.defaultMarketType]);

  const selectedSymbol = selectedInstrument?.exchangeSymbol ?? selectedInstrument?.symbol;
  const analysisStorageKey = activeWorkspaceId && chartExchangeCode && selectedSymbol
    ? `syncexc:terminal:analysis:${activeWorkspaceId}:${chartExchangeCode}:${selectedSymbol}`
    : null;

  useEffect(() => {
    if (!analysisStorageKey) {
      setIndicators(['sma20']);
      setLevels([]);
      return;
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(analysisStorageKey) || '{}');
      setIndicators(Array.isArray(saved.indicators) ? saved.indicators : ['sma20']);
      setLevels(Array.isArray(saved.levels) ? saved.levels : []);
    } catch {
      setIndicators(['sma20']);
      setLevels([]);
    }
  }, [analysisStorageKey]);

  useEffect(() => {
    if (!analysisStorageKey) return;
    window.localStorage.setItem(
      analysisStorageKey,
      JSON.stringify({ indicators, levels, timeframe }),
    );
  }, [analysisStorageKey, indicators, levels, timeframe]);

  const toggleIndicator = (indicator) => {
    setIndicators((current) => current.includes(indicator)
      ? current.filter((item) => item !== indicator)
      : [...current, indicator]);
  };

  const marketDataQuery = useTerminalMarketData(activeWorkspaceId, {
    exchangeCode: chartExchangeCode,
    symbol: selectedSymbol,
    marketType: selectedInstrument?.marketType ?? 'spot',
    timeframe,
    limit: 120,
  });
  const marketData = marketDataQuery.data;
  const quoteConversionMarket = findUsdConversionMarket(
    selectedInstrument?.quoteAsset,
    instruments,
  );
  const quoteConversionMarketDataQuery = useTerminalMarketData(activeWorkspaceId, {
    exchangeCode: chartExchangeCode,
    symbol: quoteConversionMarket?.instrument.exchangeSymbol ??
      quoteConversionMarket?.instrument.symbol,
    marketType: 'spot',
    timeframe: '1h',
    limit: 25,
  });
  const usdConversionRate = getUsdConversionRate(
    selectedInstrument?.quoteAsset,
    quoteConversionMarket,
    quoteConversionMarketDataQuery.data?.overview?.lastPrice,
  );
  const usdConversionApproximate = ['USDT', 'USDC'].includes(
    String(selectedInstrument?.quoteAsset || '').toUpperCase(),
  );
  const selectedMarketType = selectedInstrument?.marketType ?? 'spot';
  const destinationInstrument = useMemo(
    () => findCompatibleInstrument(destinationInstruments, selectedInstrument),
    [destinationInstruments, selectedInstrument],
  );
  const destinationMarketType = destinationInstrument?.marketType ?? selectedMarketType;
  const destinationSymbol =
    destinationInstrument?.exchangeSymbol ?? destinationInstrument?.symbol;
  const destinationMarketDataQuery = useTerminalMarketData(activeWorkspaceId, {
    exchangeCode: destinationConnection?.exchange,
    symbol: destinationSymbol,
    marketType: destinationMarketType,
    timeframe,
    limit: 25,
  });
  const destinationBalanceItems = destinationBalancesQuery.data?.items ?? [];
  const destinationIsFutures = ['futures', 'perpetual'].includes(destinationMarketType);
  const destinationBalanceFreshness = destinationIsFutures
    ? destinationBalancesQuery.data?.accountSnapshotFreshness ?? 'unknown'
    : destinationBalancesQuery.data?.freshness ?? 'unknown';
  const pendingOrderPreview = useMemo(
    () =>
      pendingOrder && destinationInstrument
        ? calculateOrderPreview({
            ...pendingOrder,
            orderType: pendingOrder.type,
            marketType: destinationMarketType,
            referencePrice:
              destinationMarketDataQuery.data?.overview?.markPrice ??
              destinationMarketDataQuery.data?.overview?.lastPrice,
            baseAsset: destinationInstrument.baseAsset,
            quoteAsset: destinationInstrument.quoteAsset,
            baseBalance: findAvailableBalance(
              destinationBalanceItems,
              destinationInstrument.baseAsset,
            ),
            quoteBalance: destinationIsFutures
              ? destinationBalancesQuery.data?.availableMargin
              : findAvailableBalance(
                  destinationBalanceItems,
                  destinationInstrument.quoteAsset,
                ),
          })
        : null,
    [
      pendingOrder,
      destinationInstrument,
      destinationMarketType,
      destinationMarketDataQuery.data,
      destinationBalancesQuery.data,
      destinationIsFutures,
      destinationBalanceItems,
    ],
  );

  const handleSubmitOrder = (order) => {
    setPendingOrder({ ...order, idempotencyKey: createOrderIdempotencyKey() });
    setDestinationAccountId(null);
    setApprovalRequestId(null);
    setApprovalMessage('');
    setConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (!pendingOrder) {
      return;
    }
    if (!activeWorkspaceId || !destinationAccount || !destinationInstrument) {
      toast.error('Order destination could not be verified', {
        description:
          'Select an active destination with a matching instrument before submitting this order.',
      });
      return;
    }

    setSubmitting(true);
    try {
      let result;
      if (approvalRequestId) {
        result = await terminalApi.confirmExecution(activeWorkspaceId, approvalRequestId);
      } else {
        const payload = { ...pendingOrder };
        const triggerPrice = payload.stopPrice;
        delete payload.stopPrice;
        delete payload.leverage;
        result = await terminalApi.submitOrder(activeWorkspaceId, {
          accountId: destinationAccount.id,
          connectionId: destinationAccount.connectionId,
          instrumentId: destinationInstrument.exchangeSymbol ?? destinationInstrument.symbol,
          marketType: destinationMarketType,
          ...payload,
          triggerPrice,
        });
      }

      if (result?.requiresConfirmation) {
        setApprovalRequestId(result.executionRequestId);
        setApprovalMessage(
          result.riskDecision?.reasonCode
            ? `Risk checks require a separate approval (${result.riskDecision.reasonCode}).`
            : 'Risk checks require a separate approval before this order can be sent.',
        );
        return;
      }

      if (result?.order?.status === 'rejected' || result?.order?.status === 'failed') {
        setConfirmOpen(false);
        setPendingOrder(null);
        setDestinationAccountId(null);
        setApprovalRequestId(null);
        setApprovalMessage('');
        await ordersQuery.refetch();
        toast.error('Order rejected by exchange', {
          description: result.order.rejectionReason || 'The exchange did not accept this order.',
        });
        return;
      }

      toast.success(result?.ambiguous ? 'Order status needs checking' : 'Order submitted', {
        description: result?.ambiguous
          ? 'The exchange response was uncertain. Check execution status before trying again.'
          : `Order ${result?.order?.id ?? ''} is being processed on ${destinationAccount.exchangeName ?? destinationAccount.exchange}.`,
      });
      setConfirmOpen(false);
      setPendingOrder(null);
      setDestinationAccountId(null);
      setApprovalRequestId(null);
      setApprovalMessage('');
      await ordersQuery.refetch();
    } catch (error) {
      toast.error('Order submission failed', {
        description: getErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmationOpenChange = async (open) => {
    if (open) {
      setConfirmOpen(true);
      return;
    }
    if (approvalRequestId) {
      try {
        await terminalApi.cancelExecutionConfirmation(activeWorkspaceId, approvalRequestId);
      } catch (error) {
        toast.error('Approval request was not canceled', {
          description: getErrorMessage(error),
        });
        return;
      }
    }
    setConfirmOpen(false);
    setPendingOrder(null);
    setDestinationAccountId(null);
    setApprovalRequestId(null);
    setApprovalMessage('');
  };

  if (exchangeRegistryQuery.isLoading) {
    return <LoadingState label="Loading market venues" />;
  }

  if (exchangeRegistryQuery.error) {
    return (
      <ErrorState
        title="Unable to load market venues"
        description="We could not fetch the supported market-data venues. Please try again."
        onRetry={exchangeRegistryQuery.refetch}
      />
    );
  }

  const change24h = Number(marketData?.overview?.priceChangePercent);
  const availableTimeframes = EXCHANGE_TIMEFRAMES[chartExchangeCode] ?? TIMEFRAMES;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {connectionsQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
          <span className="text-destructive">
            Connected accounts are unavailable. Market data is still viewable, but orders cannot be routed.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={connectionsQuery.refetch}>
            Retry accounts
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
        <Select
          value={chartExchangeCode ?? undefined}
          onValueChange={(exchangeCode) => {
            setSelectedInstrument(null);
            setChartExchangeCode(exchangeCode);
          }}
        >
          <SelectTrigger className="h-9 w-full min-w-[190px] border-0 bg-muted/40 sm:w-auto">
            <SelectValue placeholder="Select market venue" />
          </SelectTrigger>
          <SelectContent>
            {exchangeRegistryQuery.exchanges.map((exchange) => (
              <SelectItem key={exchange.id} value={exchange.id}>
                {exchange.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <InstrumentSelector
          instruments={instruments}
          value={getInstrumentValue(selectedInstrument)}
          onChange={setSelectedInstrument}
          isLoading={marketsQuery.isLoading || (isWorkspaceLoading && !activeWorkspaceId)}
          isError={marketsQuery.isError}
          onRetry={marketsQuery.refetch}
          className="h-9 w-full min-w-[220px] border-0 bg-muted/40 sm:w-auto"
        />
        {!activeWorkspaceId ? (
          <span className="text-xs text-warning">
            {isWorkspaceLoading
              ? 'Loading the active workspace market catalog…'
              : 'Select an active workspace to load market pairs.'}
          </span>
        ) : marketsQuery.isLoading ? (
          <span className="text-xs text-muted-foreground">
            Loading all spot and futures pairs…
          </span>
        ) : marketsQuery.isError ? (
          <div className="flex items-center gap-2 text-xs text-destructive" role="status">
            <span>Market pairs could not be loaded: {getErrorMessage(marketsQuery.error)}</span>
            <Button type="button" size="sm" variant="outline" onClick={marketsQuery.refetch}>
              Retry
            </Button>
          </div>
        ) : instruments.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {instruments.length.toLocaleString()} spot and futures pairs loaded
          </span>
        ) : (
          <span className="text-xs text-warning">
            No active pairs were returned for {chartExchange?.name ?? chartExchangeCode}.
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 px-2 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              marketData?.freshness?.state === 'stale' ? 'bg-warning' : 'bg-success'
            }`}
          />
          <span className="text-muted-foreground">
            {marketDataQuery.isFetching && marketData ? 'Updating market data' : 'Market data'}
          </span>
          {marketData?.freshness?.state === 'stale' && (
            <span className="rounded-full bg-warning/15 px-2 py-1 text-warning">Stale</span>
          )}
          {marketDataQuery.isError && (
            <span className="text-destructive">Unavailable</span>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
          <div className="min-w-[180px]">
            <p className="text-xs text-muted-foreground">
              {selectedInstrument?.baseAsset ?? 'Market'} / {selectedInstrument?.quoteAsset ?? ''}
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-2xs uppercase">
                {selectedInstrument?.marketType ?? 'spot'}
              </span>
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                {formatMarketValue(marketData?.overview?.lastPrice, 8)}
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedInstrument?.quoteAsset ?? ''}
              </span>
            </div>
          </div>
          <div className={`text-sm font-semibold ${change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
            {Number.isFinite(change24h) ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : '—'}
            <p className="mt-1 text-2xs font-normal text-muted-foreground">24h change</p>
          </div>
          {[
            ['24h high', marketData?.overview?.highPrice24h],
            ['24h low', marketData?.overview?.lowPrice24h],
            ['24h volume', marketData?.overview?.quoteVolume24h],
            ['Mark price', marketData?.overview?.markPrice],
            ['Funding rate', marketData?.overview?.fundingRate == null
              ? null
              : `${(Number(marketData.overview.fundingRate) * 100).toFixed(4)}%`],
          ].map(([label, value]) => (
            <div key={label} className="min-w-[100px] text-xs">
              <p className="text-2xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-medium text-foreground">
                {typeof value === 'string' ? value : formatMarketValue(value, 6)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_250px]">
          <Card className="min-w-0 overflow-hidden">
            <div className="client-terminal-toolbar flex flex-wrap items-center justify-between gap-2 border-b border-border px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-0.5" aria-label="Chart timeframe">
                {availableTimeframes.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={timeframe === option ? 'secondary' : 'ghost'}
                    aria-pressed={timeframe === option}
                    onClick={() => setTimeframe(option)}
                    className="client-timeframe-button h-7 min-w-8 px-2 text-2xs"
                  >
                    {option}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-2xs"
                onClick={() => document.getElementById('terminal-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              >
                New order
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {selectedInstrument?.symbol ?? 'Price chart'}
                </p>
                <p className="truncate text-2xs text-muted-foreground">
                  {marketData?.source ?? chartExchange?.name ?? 'Exchange market data'}
                  {marketData?.retrievedAt
                    ? ` · ${new Date(marketData.retrievedAt).toLocaleTimeString()}`
                    : ''}
                </p>
              </div>
              <span className="rounded border border-border bg-muted/40 px-2 py-1 text-2xs uppercase tracking-wide text-muted-foreground">
                {selectedInstrument?.marketType ?? 'spot'} · {timeframe}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-1" aria-label="Technical indicators">
                {[
                  ['sma20', 'SMA 20'],
                  ['sma50', 'SMA 50'],
                  ['bollinger', 'Bollinger'],
                ].map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={indicators.includes(key) ? 'secondary' : 'ghost'}
                    aria-pressed={indicators.includes(key)}
                    onClick={() => toggleIndicator(key)}
                    className="h-7 px-2 text-2xs"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <form
                className="flex items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  const price = Number(levelInput);
                  if (Number.isFinite(price) && price > 0) {
                    setLevels((current) => [
                      ...current,
                      { id: `${Date.now()}-${current.length}`, price, label: 'User level' },
                    ]);
                    setLevelInput('');
                  }
                }}
              >
                <label className="sr-only" htmlFor="terminal-price-level">Horizontal price level</label>
                <input
                  id="terminal-price-level"
                  type="number"
                  min="0"
                  step="any"
                  value={levelInput}
                  onChange={(event) => setLevelInput(event.target.value)}
                  placeholder="Price level"
                  className="h-7 w-24 rounded-md border border-input bg-background px-2 text-2xs"
                />
                <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-2xs">
                  Add
                </Button>
              </form>
            </div>
            {levels.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-border px-3 py-2 text-xs">
                {levels.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setLevels((current) => current.filter((item) => item.id !== level.id))}
                    className="rounded border border-warning/40 px-2 py-1 text-warning hover:bg-warning/10"
                    aria-label={`Remove price level ${level.price}`}
                    title="Remove price level"
                  >
                    {formatMarketValue(level.price)} ×
                  </button>
                ))}
              </div>
            )}
            <div className="p-2">
              <PriceChart
                key={`${chartExchangeCode}:${selectedSymbol}`}
                candles={marketData?.candles ?? []}
                currentPrice={marketData?.overview?.lastPrice}
                indicators={indicators}
                levels={levels}
                timeframe={timeframe}
                isLoading={marketDataQuery.isLoading}
                error={marketDataQuery.isError ? 'Exchange market data is temporarily unavailable.' : undefined}
                onRetry={marketDataQuery.refetch}
                height={430}
                className="border-0 shadow-none"
              />
            </div>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <div className="border-b border-border px-3 py-3">
              <p className="text-sm font-semibold text-foreground">Order book</p>
              <p className="text-2xs text-muted-foreground">
                {selectedInstrument?.quoteAsset ?? 'Quote'} / {selectedInstrument?.baseAsset ?? 'Base'}
              </p>
            </div>
            <div className="max-h-[430px] overflow-y-auto">
              <OrderBook
                bids={marketData?.orderBook?.bids ?? []}
                asks={marketData?.orderBook?.asks ?? []}
                baseAsset={selectedInstrument?.baseAsset}
                quoteAsset={selectedInstrument?.quoteAsset}
              />
            </div>
            <div className="border-t border-border px-3 py-3">
              <p className="mb-2 text-sm font-semibold text-foreground">Recent trades</p>
              <div className="max-h-48 overflow-y-auto">
                <RecentTrades
                  trades={marketData?.recentTrades ?? []}
                  baseAsset={selectedInstrument?.baseAsset}
                  quoteAsset={selectedInstrument?.quoteAsset}
                />
              </div>
            </div>
          </Card>
        </div>

        <Card id="terminal-order-form" className="min-w-0 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Place order</p>
            <p className="text-2xs text-muted-foreground">
              Market: {chartExchange?.name ?? chartExchangeCode ?? 'Select a venue'} · choose an execution account after entering order details
            </p>
            <p className="mt-1 text-2xs text-muted-foreground">
              Chart prices are a reference. Orders route to the selected account's matching market; the server validates exchange rules before dispatch.
            </p>
          </div>
          <CardContent className="p-4">
            {connectionsQuery.isLoading ? (
              <LoadingState label="Loading destination accounts" />
            ) : connectionsQuery.isError ? (
              <EmptyState
                title="Destination accounts unavailable"
                description="Retry the account list before placing an order. Market browsing remains available."
                action={
                  <Button type="button" size="sm" variant="outline" onClick={connectionsQuery.refetch}>
                    Retry accounts
                  </Button>
                }
                size="sm"
                className="border-0 bg-transparent py-6"
              />
            ) : !destinationAccounts.length ? (
              <EmptyState
                title="Connect an execution account"
                description="You can browse markets without an account. Connect an exchange to route an order."
                action={
                  <Button asChild size="sm">
                    <a href={ROUTES.app.connections.create}>Connect exchange</a>
                  </Button>
                }
                size="sm"
                className="border-0 bg-transparent py-6"
              />
            ) : selectedInstrument ? (
              <OrderForm
                instrument={selectedInstrument}
                marketType={selectedInstrument.marketType ?? 'spot'}
                defaultOrderType={tradingPreferences?.defaultOrderType ?? 'limit'}
                referencePrice={
                  marketData?.overview?.markPrice ?? marketData?.overview?.lastPrice
                }
                usdConversionRate={usdConversionRate}
                usdConversionApproximate={usdConversionApproximate}
                universalMode
                maxLeverage={1}
                onSubmit={handleSubmitOrder}
              />
            ) : (
              <EmptyState
                title="Select an instrument"
                description="Choose a market venue and instrument to enter an order."
                size="sm"
                className="border-0 bg-transparent py-6"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="positions">
        <div className="overflow-x-auto border-b border-border">
          <TabsList className="h-10 min-w-max rounded-none bg-transparent p-0">
            <TabsTrigger value="positions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Positions
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Open Orders
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Order History
            </TabsTrigger>
            <TabsTrigger value="trades" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Trade History
            </TabsTrigger>
            <TabsTrigger value="executions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Executions
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="positions" className="mt-3">
          <Positions
            workspaceId={activeWorkspaceId}
            accountId={undefined}
            marketType={selectedInstrument?.marketType ?? 'spot'}
          />
        </TabsContent>
        <TabsContent value="orders" className="mt-3">
          <OpenOrders workspaceId={activeWorkspaceId} />
        </TabsContent>
        <TabsContent value="history" className="mt-3">
          <OpenOrders workspaceId={activeWorkspaceId} status="all" />
        </TabsContent>
        <TabsContent value="trades" className="mt-3">
          <TradeHistory workspaceId={activeWorkspaceId} />
        </TabsContent>
        <TabsContent value="executions" className="mt-3">
          <ExecutionStatus workspaceId={activeWorkspaceId} />
        </TabsContent>
      </Tabs>

      <OrderConfirmationModal
        open={confirmOpen}
        onOpenChange={handleConfirmationOpenChange}
        order={pendingOrder}
        instrument={selectedInstrument}
        destinationAccounts={destinationAccounts}
        account={destinationAccount}
        destinationAccountId={destinationAccountId}
        onDestinationAccountChange={setDestinationAccountId}
        destinationInstrument={destinationInstrument}
        destinationMarketsLoading={destinationMarketsQuery.isLoading}
        destinationMarketsError={destinationMarketsQuery.isError}
        onRetryDestinationMarkets={destinationMarketsQuery.refetch}
        destinationMarketDataLoading={destinationMarketDataQuery.isFetching}
        destinationMarketDataError={destinationMarketDataQuery.isError}
        destinationBalanceLoading={destinationBalancesQuery.isLoading}
        destinationBalanceError={destinationBalancesQuery.isError}
        marketDataVenue={chartExchange?.name ?? chartExchangeCode}
        universalMode
        orderPreview={pendingOrderPreview}
        usdConversionRate={usdConversionRate}
        usdConversionApproximate={usdConversionApproximate}
        balanceFreshness={destinationBalanceFreshness}
        onConfirm={handleConfirmOrder}
        isSubmitting={submitting}
        approvalRequired={Boolean(approvalRequestId)}
        approvalMessage={approvalMessage}
      />
    </div>
  );
}

function createOrderIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}