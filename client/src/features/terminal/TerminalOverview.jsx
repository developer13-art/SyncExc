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
import { useTerminalMarkets, useTerminalOrders } from '../../hooks/useTerminal.js';
import { useConnections, useConnection } from '../../hooks/useConnections.js';
import { terminalApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function TerminalOverview() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeWorkspaceId } = useWorkspaceContext();

  const connectionsQuery = useConnections({ status: 'active' });

  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const connections = connectionsQuery.data?.items ?? [];

  const accounts = useMemo(
    () =>
      connections.flatMap((c) =>
        (c.accounts ?? []).map((a) => ({
          ...a,
          connectionId: c.id,
          exchangeName: c.exchangeName,
          healthStatus: c.health?.status,
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

  const connectionDetailQuery = useConnection(activeConnection?.id);

  const handleSubmitOrder = (order) => {
    setPendingOrder(order);
    setConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (!pendingOrder || !selectedInstrument || !selectedAccountId) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await terminalApi.submitOrder(activeWorkspaceId, {
        accountId: selectedAccountId,
        connectionId: activeConnection.id,
        instrumentId: selectedInstrument.id ?? selectedInstrument.symbol,
        marketType: selectedInstrument.marketType ?? 'spot',
        ...pendingOrder,
      });

      toast.success('Order submitted', {
        description: `Order ${result?.id ?? ''} is being processed.`,
      });
      setConfirmOpen(false);
      setPendingOrder(null);
      await ordersQuery.refetch();
    } catch (error) {
      toast.error('Order submission failed', {
        description: getErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
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
                <CardContent className="p-0">
                  <PriceChart
                    candles={selectedInstrument?.candles ?? []}
                    isLoading={marketsQuery.isLoading && !selectedInstrument}
                    className="border-0 shadow-none"
                  />
                </CardContent>
              </Card>

              <div className="grid gap-5 md:grid-cols-2">
                <Card>
                  <CardContent className="p-0">
                    <OrderBook
                      bids={selectedInstrument?.orderBook?.bids ?? []}
                      asks={selectedInstrument?.orderBook?.asks ?? []}
                      baseAsset={selectedInstrument?.baseAsset}
                      quoteAsset={selectedInstrument?.quoteAsset}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-0">
                    <RecentTrades
                      trades={selectedInstrument?.recentTrades ?? []}
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
        onOpenChange={setConfirmOpen}
        order={pendingOrder}
        instrument={selectedInstrument}
        account={accounts.find((a) => a.id === selectedAccountId)}
        onConfirm={handleConfirmOrder}
        isSubmitting={submitting}
      />
    </div>
  );
}