import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PaymentStatusBadge } from '../../../components/domain/payment/PaymentStatusBadge.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';

export function PaymentTable({ payments = [], isLoading, className }) {
  const columns = [
    {
      key: 'createdAt',
      label: 'Date',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatDateTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => (
        <span className="text-sm text-foreground">
          {row.description ?? row.planName ?? 'Subscription payment'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.amount, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'provider',
      label: 'Provider',
      render: (row) => (
        <span className="text-2xs uppercase tracking-wide text-muted-foreground">
          {row.provider ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <PaymentStatusBadge status={row.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={payments}
      isLoading={isLoading}
      emptyTitle="No payments yet"
      emptyDescription="Your payment history will appear here."
      className={className}
    />
  );
}