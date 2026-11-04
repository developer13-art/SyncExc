import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export function UserTradingPanel({ userDetails }) {
  const summary = userDetails.tradingSummary ?? {};
  const marketplaceSubscriptions = userDetails.marketplaceSubscriptions ?? [];
  const trades = userDetails.recentTrades ?? [];
  const orders = userDetails.recentOrders ?? [];
  const positions = userDetails.positions ?? [];
  const systemSubscriptions = userDetails.subscriptions ?? [];

  const subscriptionColumns = [
    {
      key: 'provider',
      label: 'Trader / plan',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.providerName || row.providerHandle || 'Trader'}</p>
          <p className="text-xs text-muted-foreground">{row.planName || 'Plan'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Account role',
      render: (row) => <Badge variant={row.isSubscriber ? 'info' : 'muted'}>{row.isSubscriber ? 'Subscriber' : 'Trader'}</Badge>,
    },
    {
      key: 'subscriber',
      label: 'Subscriber',
      render: (row) => row.subscriberEmail || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge variant={row.status === 'active' ? 'success' : 'warning'}>{row.status}</Badge>,
    },
    {
      key: 'payments',
      label: 'Confirmed payments',
      render: (row) => row.grossPaidMinor
        ? `${row.currency ?? ''} ${(Number(row.grossPaidMinor) / 100).toFixed(2)}`
        : '—',
    },
    {
      key: 'period',
      label: 'Expires',
      render: (row) => row.currentPeriodEnd ? formatDateTime(row.currentPeriodEnd) : '—',
    },
  ];

  const tradeColumns = [
    { key: 'instrument', label: 'Instrument' },
    { key: 'side', label: 'Side' },
    { key: 'quantity', label: 'Quantity' },
    {
      key: 'pnl',
      label: 'Realized PnL',
      render: (row) => row.realizedPnl ?? '—',
    },
    {
      key: 'closedAt',
      label: 'Closed',
      render: (row) => row.closedAt ? formatDateTime(row.closedAt) : '—',
    },
  ];

  const orderColumns = [
    { key: 'instrument', label: 'Instrument' },
    { key: 'side', label: 'Side' },
    { key: 'type', label: 'Type' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge variant={row.status === 'filled' ? 'success' : 'muted'}>{row.status}</Badge>,
    },
    { key: 'filledQuantity', label: 'Filled quantity' },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => row.createdAt ? formatDateTime(row.createdAt) : '—',
    },
  ];

  const positionColumns = [
    { key: 'instrument', label: 'Instrument' },
    { key: 'side', label: 'Side' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'entryPrice', label: 'Entry' },
    { key: 'markPrice', label: 'Mark' },
    { key: 'unrealizedPnl', label: 'Unrealized PnL' },
  ];

  const systemSubscriptionColumns = [
    { key: 'planName', label: 'System plan' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge variant={row.status === 'active' ? 'success' : 'warning'}>{row.status}</Badge>,
    },
    {
      key: 'price',
      label: 'Price',
      render: (row) => row.amountMinor == null
        ? '—'
        : `${row.currency} ${(Number(row.amountMinor) / 100).toFixed(2)} / ${row.billingInterval}`,
    },
    {
      key: 'currentPeriodEnd',
      label: 'Expires',
      render: (row) => row.currentPeriodEnd ? formatDateTime(row.currentPeriodEnd) : '—',
    },
    {
      key: 'nextBillingAt',
      label: 'Next billing',
      render: (row) => row.nextBillingAt ? formatDateTime(row.nextBillingAt) : '—',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Closed trades" value={summary.closedTradeCount ?? 0} />
        <Metric label="Winning trades" value={summary.winningTradeCount ?? 0} />
        <Metric label="Losing trades" value={summary.losingTradeCount ?? 0} />
      </div>

      <Card>
        <CardHeader><CardTitle>SyncExc subscription</CardTitle></CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={systemSubscriptionColumns}
            rows={systemSubscriptions}
            emptyTitle="No system subscription"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Marketplace subscriptions</CardTitle></CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={subscriptionColumns}
            rows={marketplaceSubscriptions}
            emptyTitle="No marketplace subscriptions"
            emptyDescription="Subscriptions where this user is a subscriber or trader appear here."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Open positions</CardTitle></CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable columns={positionColumns} rows={positions} emptyTitle="No open positions" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent trades</CardTitle></CardHeader>
        <CardContent className="p-5 pt-0">
          <p className="mb-3 text-xs text-muted-foreground">
            Exchange-reported PnL is shown per trade; values across different instruments are not combined.
          </p>
          <DataTable columns={tradeColumns} rows={trades} emptyTitle="No closed trades" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable columns={orderColumns} rows={orders} emptyTitle="No trading orders" />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
