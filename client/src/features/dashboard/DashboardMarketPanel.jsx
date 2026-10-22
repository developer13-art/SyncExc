import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { OrderConfirmationModal } from '../terminal/components/OrderConfirmationModal.jsx';
import { InstrumentSelector } from '../terminal/components/InstrumentSelector.jsx';
import { OrderForm } from '../terminal/components/OrderForm.jsx';
import { PriceChart } from '../terminal/components/PriceChart.jsx';
import { terminalApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';
import { formatPercent, formatPrice } from '../../lib/formatters/currency.formatter.js';
import { useConnection } from '../../hooks/useConnections.js';
import { useToast } from '../../hooks/useToast.js';
import { useTerminalMarkets, useTerminalMarketData, useTerminalOrders } from '../../hooks/useTerminal.js';
import { queryKeys } from '../../hooks/queryKeys.js';

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

export function DashboardMarketPanel({
  workspaceId,
  connections = [],
  isLoadingConnections = false,
  connectionsError,
  onRetryConnections,
  canViewConnections = true,
}) {
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [pendingOrder, setPendingOrder] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approvalRequestId, setApprovalRequestId] = useState(null);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const activeConnection = useMemo(
    () =>
      canViewConnections
        ? connections.find(
            (connection) =>
              connection.status === 'active' &&
              connection.exchange &&
              connection.accounts?.some((account) => account.status === 'active'),
          ) ?? null
        : null,
    [canViewConnections, connections],
  );
  const marketsQuery = useTerminalMarkets(workspaceId, {
    exchangeCode: activeConnection?.exchange,
  });
  const instruments = marketsQuery.data ?? [];

  useEffect(() => {
    if (!instruments.length) {
      setSelectedInstrument(null);
      return;
    }
    const selectedSymbol = selectedInstrument?.exchangeSymbol ?? selectedInstrument?.symbol;
    const selectionIsAvailable = instruments.some(
      (instrument) =>
        (instrument.exchangeSymbol ?? instrument.symbol) === selectedSymbol &&
        (instrument.marketType ?? 'spot') === (selectedInstrument?.marketType ?? 'spot'),
    );
    if (selectionIsAvailable) return;

    setSelectedInstrument(
      instruments.find((instrument) => instrument.symbol === 'BTCUSDT' && instrument.marketType === 'linear') ??
        instruments.find((instrument) => instrument.symbol === 'BTCUSDT') ??
        instruments[0],
    );
  }, [instruments, selectedInstrument]);

  const symbol = selectedInstrument?.exchangeSymbol ?? selectedInstrument?.symbol;
  const marketDataQuery = useTerminalMarketData(workspaceId, {
    exchangeCode: activeConnection?.exchange,
    symbol,
    marketType: selectedInstrument?.marketType ?? 'spot',
    timeframe,
    limit: 120,
  });
  const marketData = marketDataQuery.data;
  const lastPrice = marketData?.overview?.lastPrice;
  const changePercent = marketData?.overview?.priceChangePercent;
  const isPositive = Number(changePercent) >= 0;
  const activeAccount = activeConnection?.accounts?.find((account) => account.status === 'active') ?? null;
  const accountDetailsQuery = useConnection(activeConnection?.id, activeAccount?.id);
  const ordersQuery = useTerminalOrders(
    activeAccount?.id ? workspaceId : null,
    { accountId: activeAccount?.id, status: 'open' },
  );
  const balances = accountDetailsQuery.balances ?? [];
  const baseBalance = balances.find((balance) => balance.asset === selectedInstrument?.baseAsset)?.available;
  const quoteAsset = selectedInstrument?.settlementAsset ?? selectedInstrument?.quoteAsset;
  const quoteBalance = balances.find((balance) => balance.asset === quoteAsset)?.available;
  const isDerivative = ['linear', 'inverse', 'futures', 'perpetual'].includes(selectedInstrument?.marketType);
  const orderInstrument = selectedInstrument
    ? {
        ...selectedInstrument,
        lastPrice,
        markPrice: marketData?.overview?.markPrice ?? lastPrice,
      }
    : null;
  const orderAccount = activeAccount
    ? {
        ...activeAccount,
        label: [activeConnection?.label, activeConnection?.environment, activeAccount.accountType]
          .filter(Boolean)
          .join(' · '),
      }
    : null;

  const handleSubmitOrder = (order) => {
    setPendingOrder({ ...order, idempotencyKey: createOrderIdempotencyKey() });
    setApprovalRequestId(null);
    setApprovalMessage('');
    setConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (!pendingOrder || !selectedInstrument || !activeConnection || !activeAccount) return;

    setIsSubmitting(true);
    try {
      let result;
      if (approvalRequestId) {
        result = await terminalApi.confirmExecution(workspaceId, approvalRequestId);
      } else {
        const payload = { ...pendingOrder };
        const triggerPrice = payload.stopPrice;
        delete payload.stopPrice;
        delete payload.leverage;
        result = await ordersQuery.submitOrder({
          accountId: activeAccount.id,
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

      if (result?.order?.status === 'rejected') {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.terminal.overview(workspaceId),
        });
        setConfirmOpen(false);
        setPendingOrder(null);
        setApprovalRequestId(null);
        setApprovalMessage('');
        toast.error('Order rejected by exchange', {
          description: result.order.rejectionReason || 'The exchange did not accept this order.',
        });
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.terminal.overview(workspaceId),
      });
      toast.success(result?.ambiguous ? 'Order status needs checking' : 'Order submitted', {
        description: result?.ambiguous
          ? 'The exchange response was uncertain. Check execution status before trying again.'
          : `Order ${result?.order?.id ?? ''} is being processed.`,
      });
      setConfirmOpen(false);
      setPendingOrder(null);
      setApprovalRequestId(null);
      setApprovalMessage('');
    } catch (error) {
      toast.error('Order submission failed', {
        description: getErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmationOpenChange = async (open) => {
    if (open) {
      setConfirmOpen(true);
      return;
    }
    if (approvalRequestId) {
      try {
        await terminalApi.cancelExecutionConfirmation(workspaceId, approvalRequestId);
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

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-border bg-muted/15 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Market overview
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {selectedInstrument?.symbol ?? 'Live markets'}
              </h2>
              {marketData?.freshness?.state ? (
                <Badge variant={marketData.freshness.state === 'stale' ? 'warning' : 'success'}>
                  {marketData.freshness.state === 'stale' ? 'Delayed' : 'Live'}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {instruments.length > 0 ? (
              <InstrumentSelector
                instruments={instruments}
                value={selectedInstrument?.id ?? selectedInstrument?.symbol}
                onChange={setSelectedInstrument}
                isLoading={marketsQuery.isLoading}
                isError={marketsQuery.isError}
                onRetry={marketsQuery.refetch}
                className="h-9 w-44 border-border bg-background"
              />
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link to={ROUTES.app.terminal.overview}>
                Open terminal <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
        {selectedInstrument ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                {lastPrice == null ? '—' : formatPrice(lastPrice)}
              </span>
              {changePercent != null ? (
                <span className={isPositive ? 'text-sm font-medium text-success' : 'text-sm font-medium text-destructive'}>
                  {formatPercent(changePercent, { showSign: true })}
                  <span className="ml-1 text-xs text-muted-foreground">24h</span>
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              {TIMEFRAMES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={timeframe === value}
                  onClick={() => setTimeframe(value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    timeframe === value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {value}
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Refresh market chart"
                onClick={() => marketDataQuery.refetch()}
                disabled={marketDataQuery.isFetching}
                className="h-7 w-7"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${marketDataQuery.isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-3 sm:p-5">
        {!canViewConnections ? (
          <EmptyState
            title="Market chart unavailable"
            description="Your workspace role does not have permission to view exchange connections."
            size="sm"
            className="border-0 bg-transparent py-10"
          />
        ) : isLoadingConnections ? (
          <div className="flex h-[340px] items-center justify-center text-sm text-muted-foreground">
            Loading exchange markets…
          </div>
        ) : connectionsError ? (
          <EmptyState
            title="Unable to load connected exchanges"
            description={connectionsError.message}
            action={
              <Button type="button" variant="outline" size="sm" onClick={onRetryConnections}>
                Retry
              </Button>
            }
            size="sm"
            className="border-0 bg-transparent py-10"
          />
        ) : !activeConnection ? (
          <EmptyState
            title="Connect an exchange to view live charts"
            description="Live prices and candles are shown from your connected exchange. No sample market data is displayed."
            action={
              <Button asChild size="sm">
                <Link to={ROUTES.app.connections.create}>Connect exchange</Link>
              </Button>
            }
            size="sm"
            className="border-0 bg-transparent py-10"
          />
        ) : marketsQuery.isError ? (
          <EmptyState
            title="Unable to load markets"
            description="The exchange market list could not be loaded."
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => marketsQuery.refetch()}>
                Retry
              </Button>
            }
            size="sm"
            className="border-0 bg-transparent py-10"
          />
        ) : !selectedInstrument ? (
          <EmptyState
            title="No markets available"
            description="This exchange has not returned any supported instruments."
            size="sm"
            className="border-0 bg-transparent py-10"
          />
        ) : (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)]">
            <PriceChart
              candles={marketData?.candles ?? []}
              currentPrice={lastPrice}
              isLoading={marketDataQuery.isLoading}
              error={marketDataQuery.error}
              onRetry={marketDataQuery.refetch}
              height={340}
              className="gap-1"
            />
            <section className="min-w-0 rounded-xl border border-border bg-background/70">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Quick trade</h3>
                <p className="mt-1 truncate text-2xs text-muted-foreground">
                  {orderAccount?.label ?? 'Exchange account'} · {selectedInstrument.marketType ?? 'spot'}
                </p>
              </div>
              <div className="p-4">
                {activeAccount && orderInstrument ? (
                  <OrderForm
                    instrument={orderInstrument}
                    account={orderAccount}
                    marketType={isDerivative ? 'futures' : 'spot'}
                    availableBalance={baseBalance}
                    availableMargin={quoteBalance}
                    availableBalances={{
                      buy: quoteBalance,
                      sell: isDerivative ? quoteBalance : baseBalance,
                    }}
                    maxLeverage={1}
                    isSubmitting={isSubmitting}
                    onSubmit={handleSubmitOrder}
                    className="gap-3"
                  />
                ) : (
                  <EmptyState
                    title="Select an active account"
                    description="An active exchange account is required to place a trade."
                    size="sm"
                    className="border-0 bg-transparent py-8"
                  />
                )}
              </div>
            </section>
          </div>
        )}
      </CardContent>
      <OrderConfirmationModal
        open={confirmOpen}
        onOpenChange={handleConfirmationOpenChange}
        order={pendingOrder}
        instrument={orderInstrument}
        account={orderAccount}
        onConfirm={handleConfirmOrder}
        isSubmitting={isSubmitting}
        approvalRequired={Boolean(approvalRequestId)}
        approvalMessage={approvalMessage}
      />
    </Card>
  );
}

function createOrderIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
