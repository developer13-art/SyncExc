import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { AccountSelector } from './components/AccountSelector.jsx';
import { InstrumentSelector } from './components/InstrumentSelector.jsx';
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
import { useConnections, useConnection } from '../../hooks/useConnections.js';
import { terminalApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

function formatMarketValue(value, maximumFractionDigits = 6) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits });
}

export default function TerminalOverview() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeWorkspaceId } = useWorkspaceContext();

  const connectionsQuery = useConnections({ status: 'active' });

  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [indicators, setIndicators] = useState(['sma20']);
  const [levels, setLevels] = useState([]);
  const [levelInput, setLevelInput] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approvalRequestId, setApprovalRequestId] = useState(null);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const connections = connectionsQuery.data?.items ?? [];

  const accounts = useMemo(
    () =>
      connections.flatMap((c) =>
        (c.accounts ?? []).map((a) => ({
          ...a,
          label: [c.label, c.environment, a.accountType ?? a.type]
            .filter(Boolean)
            .join(' · '),
          type: a.type ?? a.accountType,
          connectionId: c.id,
          exchangeName: c.exchangeName,
          environment: c.environment,
          healthStatus:
            c.status === 'degraded' ? 'degraded' : c.health?.status ?? c.status,
        })),
      ),
    [connections],
  );

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Trading Terminal'));
    dispatch(uiActions.setBreadcrumbs([{ label: 'Terminal', path: '/app/terminal' }]));
  }, [dispatch]);

  const activeConnection = useMemo(() => {
    const account = accounts.find((a) => a.id === selectedAccountId);
    return connections.find((c) => c.id === account?.connectionId) ?? null;
  }, [accounts, connections, selectedAccountId]);

  const marketsQuery = useTerminalMarkets(activeWorkspaceId, {
    exchangeCode: activeConnection?.exchange,
    marketType: 'spot',
  });

  const ordersQuery = useTerminalOrders(activeWorkspaceId, {
    accountId: selectedAccountId ?? undefined,
    status: 'open',
  });

  const instruments = marketsQuery.data ?? [];

  useEffect(() => {
    if (!instruments.length) {
      setSelectedInstrument(null);
      return;
    }
    const currentSymbol = selectedInstrument?.exchangeSymbol ?? selectedInstrument?.symbol;
    if (!currentSymbol || !instruments.some((item) =>
      (item.exchangeSymbol ?? item.symbol) === currentSymbol
    )) {
      setSelectedInstrument(instruments[0]);
    }
  }, [instruments, selectedInstrument]);

  const selectedSymbol = selectedInstrument?.exchangeSymbol ?? selectedInstrument?.symbol;
  const analysisStorageKey = activeWorkspaceId && activeConnection?.exchange && selectedSymbol
    ? `syncexc:terminal:analysis:${activeWorkspaceId}:${activeConnection.exchange}:${selectedSymbol}`
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
    exchangeCode: activeConnection?.exchange,
    symbol: selectedSymbol,
    marketType: selectedInstrument?.marketType ?? 'spot',
    timeframe,
    limit: 120,
  });
  const marketData = marketDataQuery.data;
  const connectionDetailQuery = useConnection(activeConnection?.id, selectedAccountId);

  const handleSubmitOrder = (order) => {
    setPendingOrder({ ...order, idempotencyKey: createOrderIdempotencyKey() });
    setApprovalRequestId(null);
    setApprovalMessage('');
    setConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (!pendingOrder || !selectedInstrument || !selectedAccountId) {
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
          accountId: selectedAccountId,
          connectionId: activeConnection.id,
          instrumentId: selectedInstrument.exchangeSymbol ?? selectedInstrument.symbol,
          marketType: selectedInstrument.marketType ?? 'spot',
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

      toast.success(result?.ambiguous ? 'Order status needs checking' : 'Order submitted', {
        description: result?.ambiguous
          ? 'The exchange response was uncertain. Check execution status before trying again.'
          : `Order ${result?.order?.id ?? ''} is being processed.`,
      });
      setConfirmOpen(false);
      setPendingOrder(null);
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
    setApprovalRequestId(null);
    setApprovalMessage('');
  };

  if (connectionsQuery.isLoading) {
    return <LoadingState label="Loading connections" />;
  }

  if (connectionsQuery.isError) {
    return (
      <ErrorState
        title="Unable to load connections"
        description="We could not fetch your connected exchanges. Please try again."
        onRetry={connectionsQuery.refetch}
      />
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No connected accounts"
        description="Connect a supported exchange to access the trading terminal."
        action={
          <Button asChild>
            <a href={ROUTES.app.connections.create}>Connect exchange</a>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <AccountSelector
          accounts={accounts}
          value={selectedAccountId}
          onChange={setSelectedAccountId}
          className="w-full max-w-xs"
        />
        <InstrumentSelector
          instruments={instruments}
          value={selectedInstrument?.id ?? selectedInstrument?.symbol}
          onChange={setSelectedInstrument}
          isLoading={marketsQuery.isLoading}
          isError={marketsQuery.isError}
          onRetry={marketsQuery.refetch}
          className="w-full max-w-xs"
        />
      </div>

      <Tabs defaultValue="trade">
        <TabsList>
          <TabsTrigger value="trade">Trade</TabsTrigger>
          <TabsTrigger value="orders">Open Orders</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
        </TabsList>

        <TabsContent value="trade">
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-5">
              <Card>
                <CardContent className="space-y-3 p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium text-foreground">
                          {activeConnection?.exchangeName ?? activeConnection?.exchange ?? 'Exchange'} market data
                        </span>
                        <span className="text-muted-foreground">
                          {marketDataQuery.isFetching && marketData ? 'Refreshing…' : ''}
                        </span>
                        {marketData?.freshness?.state === 'stale' && (
                          <span className="rounded bg-warning/15 px-2 py-0.5 text-warning">
                            Stale data
                          </span>
                        )}
                        {marketDataQuery.isError && (
                          <span className="text-destructive">Market data unavailable</span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-2xs text-muted-foreground">
                        {marketData?.source ?? 'No exchange data loaded'}
                        {marketData?.retrievedAt
                          ? ` · Retrieved ${new Date(marketData.retrievedAt).toLocaleTimeString()}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1" aria-label="Chart timeframe">
                      {TIMEFRAMES.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant={timeframe === option ? 'secondary' : 'ghost'}
                          aria-pressed={timeframe === option}
                          onClick={() => setTimeframe(option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 px-4">
                    <div className="flex flex-wrap items-center gap-2" aria-label="Technical indicators">
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
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    <form
                      className="flex items-center gap-2"
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
                        className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs"
                      />
                      <Button type="submit" size="sm" variant="outline">Add level</Button>
                    </form>
                  </div>
                  {levels.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-4 text-xs">
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

                  <div className="grid grid-cols-2 gap-3 px-4 text-xs sm:grid-cols-4 xl:grid-cols-7">
                    {[
                      ['Last', marketData?.overview?.lastPrice],
                      ['Mark', marketData?.overview?.markPrice],
                      ['Index', marketData?.overview?.indexPrice],
                      ['Funding', marketData?.overview?.fundingRate == null
                        ? null
                        : `${(Number(marketData.overview.fundingRate) * 100).toFixed(4)}%`],
                      ['Open interest', marketData?.overview?.openInterest],
                      ['24h change', marketData?.overview?.priceChangePercent == null
                        ? null
                        : `${Number(marketData.overview.priceChangePercent).toFixed(2)}%`],
                      ['24h volume', marketData?.overview?.quoteVolume24h],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-2xs text-muted-foreground">{label}</p>
                        <p className="truncate font-medium text-foreground">
                          {typeof value === 'string' ? value : formatMarketValue(value, 4)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <PriceChart
                    candles={marketData?.candles ?? []}
                    indicators={indicators}
                    levels={levels}
                    isLoading={marketDataQuery.isLoading}
                    error={marketDataQuery.isError ? 'Exchange market data is temporarily unavailable.' : undefined}
                    onRetry={marketDataQuery.refetch}
                    className="border-0 shadow-none"
                  />
                </CardContent>
              </Card>

              <div className="grid gap-5 md:grid-cols-2">
                <Card>
                  <CardContent className="p-0">
                    <OrderBook
                      bids={marketData?.orderBook?.bids ?? []}
                      asks={marketData?.orderBook?.asks ?? []}
                      baseAsset={selectedInstrument?.baseAsset}
                      quoteAsset={selectedInstrument?.quoteAsset}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-0">
                    <RecentTrades
                      trades={marketData?.recentTrades ?? []}
                      baseAsset={selectedInstrument?.baseAsset}
                      quoteAsset={selectedInstrument?.quoteAsset}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardContent className="p-5">
                {selectedInstrument && activeConnection ? (
                  <OrderForm
                    instrument={selectedInstrument}
                    account={accounts.find((a) => a.id === selectedAccountId)}
                    marketType={selectedInstrument.marketType ?? 'spot'}
                    availableBalance={
                      connectionDetailQuery.balances?.find(
                        (b) => b.asset === selectedInstrument.baseAsset,
                      )?.available ?? 0
                    }
                    availableMargin={
                      connectionDetailQuery.balances?.find(
                        (b) => b.asset === selectedInstrument.quoteAsset,
                      )?.available ?? 0
                    }
                    maxLeverage={1}
                    onSubmit={handleSubmitOrder}
                  />
                ) : (
                  <EmptyState
                    title="Select an instrument"
                    description="Choose an account and instrument to begin trading."
                    size="sm"
                    className="border-0 bg-transparent py-6"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <OpenOrders workspaceId={activeWorkspaceId} accountId={selectedAccountId} />
        </TabsContent>
        <TabsContent value="positions">
          <Positions workspaceId={activeWorkspaceId} accountId={selectedAccountId} />
        </TabsContent>
        <TabsContent value="history">
          <TradeHistory workspaceId={activeWorkspaceId} accountId={selectedAccountId} />
        </TabsContent>
        <TabsContent value="executions">
          <ExecutionStatus workspaceId={activeWorkspaceId} accountId={selectedAccountId} />
        </TabsContent>
      </Tabs>

      <OrderConfirmationModal
        open={confirmOpen}
        onOpenChange={handleConfirmationOpenChange}
        order={pendingOrder}
        instrument={selectedInstrument}
        account={accounts.find((a) => a.id === selectedAccountId)}
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