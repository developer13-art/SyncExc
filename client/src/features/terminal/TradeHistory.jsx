import { useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, RefreshCw, Search, Wallet } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { PnLIndicator } from '../../components/domain/trade/PnLIndicator.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { useTerminalTrades } from '../../hooks/useTerminal.js';
import { usePagination } from '../../hooks/usePagination.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { cn } from '../../lib/utils/cn.util.js';

const PNL_FILTERS = [
  { value: 'all', label: 'All trades' },
  { value: 'profit', label: 'Profitable' },
  { value: 'loss', label: 'Loss-making' },
  { value: 'unavailable', label: 'P&L unavailable' },
];

export function TradeHistory({ workspaceId, accountId }) {
  const pagination = usePagination({ initialPageSize: 50 });
  const [instrumentSearch, setInstrumentSearch] = useState('');
  const [pnlFilter, setPnlFilter] = useState('all');

  const tradesQuery = useTerminalTrades(workspaceId, {
    accountId: accountId ?? undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const trades = tradesQuery.data?.items ?? [];
  const filteredTrades = trades.filter((trade) => {
    const matchesInstrument = !instrumentSearch ||
      String(trade.instrument ?? trade.symbol ?? '')
        .toLowerCase()
        .includes(instrumentSearch.toLowerCase());
    const pnl = trade.realizedPnl === null || trade.realizedPnl === undefined
      ? null
      : Number(trade.realizedPnl);
    const matchesPnl = pnlFilter === 'all' ||
      (pnlFilter === 'profit' && pnl > 0) ||
      (pnlFilter === 'loss' && pnl < 0) ||
      (pnlFilter === 'unavailable' && pnl === null);
    return matchesInstrument && matchesPnl;
  });
  const knownPnlTrades = filteredTrades.filter(
    (trade) => trade.realizedPnl !== null &&
      trade.realizedPnl !== undefined &&
      Number.isFinite(Number(trade.realizedPnl))
  );
  const netRealizedPnl = knownPnlTrades.reduce(
    (sum, trade) => sum + Number(trade.realizedPnl),
    0
  );
  const winners = knownPnlTrades.filter((trade) => Number(trade.realizedPnl) > 0).length;
  const losers = knownPnlTrades.filter((trade) => Number(trade.realizedPnl) < 0).length;

  if (tradesQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(tradesQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'closedAt',
      label: 'Date',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.closedAt ? formatDateTime(row.closedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'instrument',
      label: 'Instrument',
      render: (row) => <span className="font-medium text-foreground">{row.instrument ?? row.symbol}</span>,
    },
    {
      key: 'side',
      label: 'Side',
      render: (row) => (
        <span
          className={cn(
            'text-xs font-semibold uppercase',
            row.side === 'buy' || row.side === 'long' ? 'text-success' : 'text-destructive',
          )}
        >
          {row.side}
        </span>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'right',
      render: (row) => formatQuantity(row.filledQuantity ?? row.quantity, 8),
    },
    {
      key: 'entryPrice',
      label: 'Entry Price',
      align: 'right',
      render: (row) => (
        row.entryPrice ? formatQuantity(row.entryPrice, 8) : '—'
      ),
    },
    {
      key: 'averagePrice',
      label: 'Exit / Fill Price',
      align: 'right',
      render: (row) => formatQuantity(row.averagePrice ?? row.price, 8),
    },
    {
      key: 'fees',
      label: 'Fees',
      align: 'right',
      render: (row) =>
        row.fees ? (
          <span className="text-xs text-muted-foreground">{formatQuantity(row.fees, 8)}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'realizedPnl',
      label: 'Realized P&L',
      align: 'right',
      render: (row) => (
        <PnLIndicator
          value={row.realizedPnl}
          percent={row.pnlPercent}
          currency={row.quoteCurrency ?? 'USD'}
        />
      ),
    },
    {
      key: 'account',
      label: 'Account',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.accountLabel ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Trades on this page"
          value={filteredTrades.length.toLocaleString()}
          hint="Exchange fills and closed positions"
          icon={Activity}
        />
        <StatCard
          label="Page realized P&L"
          value={knownPnlTrades.length ? formatCurrency(netRealizedPnl, 'USD') : '—'}
          hint={knownPnlTrades.length
            ? `${knownPnlTrades.length} trades with exchange-reported P&L`
            : 'No realized P&L available in this selection'}
          icon={Wallet}
          tone={netRealizedPnl > 0 ? 'success' : netRealizedPnl < 0 ? 'destructive' : 'default'}
        />
        <StatCard
          label="Profitable"
          value={winners.toLocaleString()}
          hint="Closed trades with a gain"
          icon={ArrowUpRight}
          tone="success"
        />
        <StatCard
          label="Loss-making"
          value={losers.toLocaleString()}
          hint="Closed trades with a loss"
          icon={ArrowDownRight}
          tone={losers > 0 ? 'destructive' : 'default'}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Trade ledger</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tradesQuery.isFetching
                  ? 'Syncing the latest exchange activity…'
                  : `${pagination.total.toLocaleString()} records · latest activity first`}
              </p>
            </div>
            <IconButton
              label="Refresh trade history"
              onClick={() => tradesQuery.refetch()}
              disabled={tradesQuery.isLoading}
              className="border border-border bg-background/70"
            >
              <RefreshCw className={cn('h-4 w-4', tradesQuery.isFetching && 'animate-spin')} />
            </IconButton>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <label className="relative block w-full xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={instrumentSearch}
                onChange={(event) => setInstrumentSearch(event.target.value)}
                placeholder="Filter by market, e.g. BTCUSDT"
                className="pl-9"
                aria-label="Filter trades by instrument"
              />
            </label>
            <div className="overflow-x-auto">
              <SegmentedControl
                options={PNL_FILTERS}
                value={pnlFilter}
                onChange={setPnlFilter}
              />
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <DataTable
            columns={columns}
            rows={filteredTrades}
            isLoading={tradesQuery.isLoading}
            emptyTitle={trades.length ? 'No trades match these filters' : 'No trade activity yet'}
            emptyDescription={trades.length
              ? 'Try another instrument or P&L filter.'
              : 'Exchange fills and closed positions will appear here as your account syncs.'}
          />

          {pagination.total > pagination.pageSize ? (
            <div className="mt-4 flex justify-end">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={pagination.goToPage}
                hasNext={pagination.hasNext}
                hasPrev={pagination.hasPrev}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Performance metrics summarize the currently loaded page. P&L uses exchange-reported results or FIFO spot cost basis when matching buy fills are available.
      </p>
    </div>
  );
}